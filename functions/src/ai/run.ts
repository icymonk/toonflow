import type { DocumentReference } from 'firebase-admin/firestore'
import type { ModelEntry, ModelsConfig } from '../../../shared/config'
import type { JobError, JobType, JobUsage } from '../../../shared/jobs'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { logger } from 'firebase-functions'
import { onTaskDispatched } from 'firebase-functions/v2/tasks'
import { ACTIVE_STATUSES, JOB_KIND } from '../../../shared/jobs'
import { actualKrw } from '../../../shared/pricing'
import { loadModels } from '../lib/models'
import { settle } from '../lib/usage'
import { AiError, classify, isLastAttempt } from './errors'
import { imageModel, textModel } from './providers'
import { GEMINI_API_KEY } from './providers/gemini'

/** 4:5 출력 (CMN 기본 비율) */
const PANEL_SIZE = { w: 1080, h: 1350 }

interface ProviderOutput { result: string | string[], requestId: string, usage: JobUsage }

/** 7. 제공사 호출. 이미지는 Storage에 먼저 저장하고 경로를 결과로 */
async function callProvider(wsId: string, jobId: string, type: JobType, params: Record<string, unknown>, model: ModelEntry): Promise<ProviderOutput> {
  if (JOB_KIND[type] === 'image') {
    const out = await imageModel(model).generate({ prompt: String(params.prompt ?? ''), size: PANEL_SIZE, n: Number(params.n ?? 1) })
    const bucket = getStorage().bucket()
    const paths = await Promise.all(out.images.map(async (buf, i) => {
      const path = `workspaces/${wsId}/aiJobs/${jobId}/${i}.png`
      await bucket.file(path).save(buf, { contentType: 'image/png', resumable: false })
      return path
    }))
    return { result: paths, requestId: out.requestId, usage: { images: out.billedImages } }
  }
  const out = await textModel(model).generate({ system: '', prompt: JSON.stringify(params) })
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
    if (job.get('providerResult') === undefined) {
      const model = models.models.find(m => m.id === job.get('model') && m.enabled)
      if (!model) throw new AiError('internal', `model unavailable: ${job.get('model')}`)
      const out = await callProvider(workspaceId, jobId, job.get('type'), job.get('params') ?? {}, model)
      usage = out.usage
      await ref.update({ providerResult: out.result, providerRequestId: out.requestId, usage })
    }
    // 8. 결과 반영(각색안·콘티·후보 문서)은 기능별 처리기로 1-B부터 붙인다
    await finish(ref, workspaceId, models, usage, 'succeeded')
  }
  catch (e) {
    const error = classify(e)
    if (!isLastAttempt(error.code, attempt)) {
      await ref.update({ status: 'queued', error })
      throw e
    }
    logger.error('ai job failed', { workspaceId, jobId, error })
    await finish(ref, workspaceId, models, usage, 'failed', error)
  }
})
