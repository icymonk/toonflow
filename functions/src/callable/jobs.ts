import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getFunctions } from 'firebase-admin/functions'
import { HttpsError } from 'firebase-functions/v2/https'
import { ERROR_KEYS } from '../../../shared/callables'
import { DEFAULT_MODELS } from '../../../shared/config'
import { JOB_KIND, startAiJobInput } from '../../../shared/jobs'
import { estimateKrw } from '../../../shared/pricing'
import { monthKey } from '../../../shared/usage'
import { requireMember } from '../lib/authz'
import { authedCallable } from '../lib/callable'
import { reserve } from '../lib/usage'

/** AIU-01·10~12: 권한·한도 확인 → 비용 예약 → 작업 문서 → 대기열 (docs/dev/ai-jobs.md 1절) */
export const startAiJob = authedCallable(startAiJobInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'editor')
  const db = getFirestore()
  const models = { ...DEFAULT_MODELS, ...(await db.doc('config/models').get()).data() }
  const model = data.model ?? models.defaults[JOB_KIND[data.type]]
  const inputChars = JSON.stringify(data.params).length
  const estimate = estimateKrw(models, model, data.type, { inputChars, images: Number(data.params.n ?? 1), drafts: Number(data.params.n ?? 1) })
  const jobs = db.collection(`workspaces/${data.workspaceId}/aiJobs`)

  const jobId = await db.runTransaction(async (tx) => {
    const dup = await tx.get(jobs.where('idempotencyKey', '==', data.idempotencyKey).limit(1))
    if (!dup.empty) return dup.docs[0]!.id
    if (!(await reserve(tx, data.workspaceId, estimate))) throw new HttpsError('resource-exhausted', ERROR_KEYS.limitExceeded)
    const ref = jobs.doc()
    tx.set(ref, {
      type: data.type,
      target: data.target,
      params: data.params,
      model: model ?? null,
      status: 'queued',
      estimateKrw: estimate,
      costKrw: 0,
      month: monthKey(),
      attempts: 0,
      idempotencyKey: data.idempotencyKey,
      requestedBy: uid,
      createdAt: FieldValue.serverTimestamp(),
    })
    return ref.id
  })

  await getFunctions().taskQueue('runAiJob').enqueue({ workspaceId: data.workspaceId, jobId }, { id: jobId }).catch((e: { code?: string }) => {
    // 같은 jobId 재요청이면 이미 대기열에 있다
    if (e.code !== 'functions/task-already-exists') throw e
  })
  return { jobId }
})
