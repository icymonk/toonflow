import type { DocumentReference } from 'firebase-admin/firestore'
import type { ModelEntry, ModelsConfig } from '../../../shared/config'
import type { JobError, JobType, JobUsage } from '../../../shared/jobs'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { logger } from 'firebase-functions'
import { onTaskDispatched } from 'firebase-functions/v2/tasks'
import { ACTIVE_STATUSES, JOB_KIND } from '../../../shared/jobs'
import { imageParams } from '../../../shared/library'
import { actualKrw } from '../../../shared/pricing'
import { loadModels } from '../lib/models'
import { settle } from '../lib/usage'
import { applyResult } from './apply'
import { AiError, classify, isLastAttempt } from './errors'
import { textPrompt } from './prompts/story'
import { imageModel, textModel } from './providers'
import { GEMINI_API_KEY } from './providers/gemini'

/** 4:5 출력 (CMN 기본 비율) */
const PANEL_SIZE = { w: 1080, h: 1350 }

interface ProviderOutput { result: string | string[], requestId: string, usage: JobUsage }

/** 7. 제공사 호출. 이미지는 Storage에 먼저 저장하고 경로를 결과로 */
async function callProvider(wsId: string, jobId: string, type: JobType, params: Record<string, unknown>, model: ModelEntry): Promise<ProviderOutput> {
  if (JOB_KIND[type] === 'image') {
    const p = imageParams.safeParse(params)
    if (!p.success) throw new AiError('internal', 'bad image params')
    const bucket = getStorage().bucket()
    // 참조 이미지는 이 워크스페이스 안 경로만
    const refImages = await Promise.all((p.data.refPaths ?? []).filter(path => path.startsWith(`workspaces/${wsId}/`))
      .map(async path => (await bucket.file(path).download())[0]))
    const prompts = p.data.prompts ?? [p.data.prompt ?? '']
    const n = p.data.prompts ? 1 : (p.data.n ?? 1)
    const outs = await Promise.all(prompts.map(prompt => imageModel(model).generate({ prompt, negative: p.data.negative || undefined, refImages, size: PANEL_SIZE, n })))
    const out = { images: outs.flatMap(o => o.images), requestId: outs[0]!.requestId, billedImages: outs.reduce((a, o) => a + o.billedImages, 0) }
    const paths = await Promise.all(out.images.map(async (buf, i) => {
      const path = `workspaces/${wsId}/aiJobs/${jobId}/${i}.png`
      await bucket.file(path).save(buf, { contentType: 'image/png', resumable: false })
      return path
    }))
    return { result: paths, requestId: out.requestId, usage: { images: out.billedImages } }
  }
  const out = await textModel(model).generate(textPrompt(type, params))
  return { result: out.text, requestId: out.requestId, usage: out.usage }
}

/** 9. 예약을 풀고 아직 청구하지 않은 실제 비용만 더한다 (재시도해도 두 번 청구하지 않음) */
async function finish(ref: DocumentReference, wsId: string, models: ModelsConfig, usage: JobUsage, status: 'succeeded' | 'failed', error?: JobError) {
  const db = getFirestore()
  await db.runTransaction(async (tx) => {
    const job = await tx.get(ref)
    if (job.get('status') !== 'running') return
    const charged = (job.get('costKrw') as number | undefined) ?? 0
    const total = Math.max(charged, actualKrw(models, job.get('model'), usage))
    settle(tx, wsId, job.get('month'), job.get('estimateKrw') ?? 0, total - charged, job.get('target')?.episodeId)
    tx.update(ref, { status, costKrw: total, error: error ?? FieldValue.delete(), finishedAt: FieldValue.serverTimestamp() })
  })
}

// AIU-02·03·05·13: 작업 실행 (docs/dev/ai-jobs.md 1절 5~9)
export const runAiJob = onTaskDispatched<{ workspaceId: string, jobId: string }>({
  retryConfig: { maxAttempts: 3, minBackoffSeconds: 10 },
  rateLimits: { maxConcurrentDispatches: 5 },
  timeoutSeconds: 540,
  secrets: [GEMINI_API_KEY],
}, async (req) => {
  const { workspaceId, jobId } = req.data
  const ref = getFirestore().doc(`workspaces/${workspaceId}/aiJobs/${jobId}`)
  const job = await ref.get()
  if (!job.exists || !ACTIVE_STATUSES.includes(job.get('status'))) return
  const attempt = ((job.get('attempts') as number | undefined) ?? 0) + 1
  await ref.update({ status: 'running', attempts: attempt, startedAt: FieldValue.serverTimestamp() })
  const models = await loadModels()
  let usage = (job.get('usage') as JobUsage | undefined) ?? {}

  try {
    // 6. 이미 받은 결과가 있으면 다시 호출하지 않는다 (재시도 무과금)
    let result = job.get('providerResult') as unknown
    if (result === undefined) {
      const model = models.models.find(m => m.id === job.get('model') && m.enabled)
      if (!model) throw new AiError('internal', `model unavailable: ${job.get('model')}`)
      const out = await callProvider(workspaceId, jobId, job.get('type'), job.get('params') ?? {}, model)
      usage = out.usage
      result = out.result
      await ref.update({ providerResult: out.result, providerRequestId: out.requestId, usage })
    }
    // 8. 결과 반영 (각색안·분석·제목 후보)
    await applyResult(workspaceId, jobId, job.data() as Parameters<typeof applyResult>[2], result)
    await finish(ref, workspaceId, models, usage, 'succeeded')
  }
  catch (e) {
    const error = classify(e)
    // 형식이 틀린 응답은 버리고 다음 시도에서 다시 부른다
    if (error.code === 'invalid_output') await ref.update({ providerResult: FieldValue.delete() })
    if (!isLastAttempt(error.code, attempt)) {
      await ref.update({ status: 'queued', error })
      throw e
    }
    logger.error('ai job failed', { workspaceId, jobId, error })
    await finish(ref, workspaceId, models, usage, 'failed', error)
  }
})
