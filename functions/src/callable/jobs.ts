import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getFunctions } from 'firebase-admin/functions'
import { HttpsError } from 'firebase-functions/v2/https'
import { ERROR_KEYS } from '../../../shared/callables'
import { JOB_KIND, jobRefInput, startAiJobInput } from '../../../shared/jobs'
import { estimateKrw } from '../../../shared/pricing'
import { REGION } from '../../../shared/region'
import { monthKey } from '../../../shared/usage'
import { requireMember } from '../lib/authz'
import { authedCallable } from '../lib/callable'
import { loadModels } from '../lib/models'
import { reserve, settle } from '../lib/usage'
import { checkInputChars } from '../../../shared/aicheck'
import { imageCount } from '../../../shared/library'

const jobRef = (wsId: string, jobId: string) => getFirestore().doc(`workspaces/${wsId}/aiJobs/${jobId}`)

/** 작업 대기열에 넣는다. taskId가 같으면 이미 들어가 있는 것 */
async function enqueue(workspaceId: string, jobId: string, taskId: string) {
  await getFunctions().taskQueue(`locations/${REGION}/functions/runAiJob`).enqueue({ workspaceId, jobId }, { id: taskId }).catch((e: { code?: string }) => {
    if (e.code !== 'functions/task-already-exists') throw e
  })
}

/** AIU-01·10~12: 권한·한도 확인 → 비용 예약 → 작업 문서 → 대기열 (docs/dev/ai-jobs.md 1절) */
export const startAiJob = authedCallable(startAiJobInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'editor')
  const db = getFirestore()
  const models = await loadModels()
  const kind = JOB_KIND[data.type]
  const model = data.model ?? models.defaults[kind]
  if (!models.models.some(m => m.id === model && m.enabled && m.kind === kind)) throw new HttpsError('failed-precondition', ERROR_KEYS.modelUnavailable)
  const inputChars = JSON.stringify(data.params).length + (data.type === 'panel.check' ? checkInputChars(data.params) : 0)
  const estimate = estimateKrw(models, model, data.type, { inputChars, images: imageCount(data.params), drafts: Number(data.params.n ?? 1) })
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
      model,
      status: 'queued',
      estimateKrw: estimate,
      costKrw: 0,
      month: monthKey(),
      attempts: 0,
      retries: 0,
      idempotencyKey: data.idempotencyKey,
      requestedBy: uid,
      createdAt: FieldValue.serverTimestamp(),
    })
    return ref.id
  })

  await enqueue(data.workspaceId, jobId, jobId)
  return { jobId }
})

/** AIU-03: 대기 중인 작업만 취소하고 예약을 푼다. 실행 중·끝난 작업은 그대로 둔다 */
export const cancelAiJob = authedCallable(jobRefInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'editor')
  const db = getFirestore()
  const ref = jobRef(data.workspaceId, data.jobId)
  await db.runTransaction(async (tx) => {
    const job = await tx.get(ref)
    if (!job.exists) throw new HttpsError('not-found', ERROR_KEYS.invalidInput)
    if (job.get('status') !== 'queued') return
    settle(tx, data.workspaceId, job.get('month'), job.get('estimateKrw') ?? 0, 0)
    tx.update(ref, { status: 'canceled', finishedAt: FieldValue.serverTimestamp() })
  })
  return { ok: true as const }
})

/** AIU-05: 실패한 작업을 같은 조건으로 다시 대기열에. 받아 둔 결과가 있으면 제공사를 다시 부르지 않는다 */
export const retryAiJob = authedCallable(jobRefInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'editor')
  const db = getFirestore()
  const ref = jobRef(data.workspaceId, data.jobId)
  const retry = await db.runTransaction(async (tx) => {
    const job = await tx.get(ref)
    if (!job.exists) throw new HttpsError('not-found', ERROR_KEYS.invalidInput)
    if (job.get('status') !== 'failed') return null
    const estimate = (job.get('estimateKrw') as number | undefined) ?? 0
    if (!(await reserve(tx, data.workspaceId, estimate))) throw new HttpsError('resource-exhausted', ERROR_KEYS.limitExceeded)
    const n = ((job.get('retries') as number | undefined) ?? 0) + 1
    tx.update(ref, { status: 'queued', attempts: 0, retries: n, month: monthKey(), error: FieldValue.delete(), finishedAt: FieldValue.delete() })
    return n
  })
  if (retry !== null) await enqueue(data.workspaceId, data.jobId, `${data.jobId}-r${retry}`)
  return { ok: true as const }
})
