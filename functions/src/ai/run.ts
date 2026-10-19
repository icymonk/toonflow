import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { onTaskDispatched } from 'firebase-functions/v2/tasks'
import { settle } from '../lib/usage'
import { fakeText } from './providers/fake'

// AIU-02·03·05·13: 작업 실행 (docs/dev/ai-jobs.md 1절 5~9). 제공사 어댑터는 S1·S2 뒤에 연결, 지금은 fake
export const runAiJob = onTaskDispatched<{ workspaceId: string, jobId: string }>({
  retryConfig: { maxAttempts: 3, minBackoffSeconds: 10 },
  rateLimits: { maxConcurrentDispatches: 5 },
  timeoutSeconds: 540,
}, async (req) => {
  const { workspaceId, jobId } = req.data
  const db = getFirestore()
  const ref = db.doc(`workspaces/${workspaceId}/aiJobs/${jobId}`)
  const job = await ref.get()
  if (!job.exists || ['canceled', 'succeeded', 'failed'].includes(job.get('status'))) return
  await ref.update({ status: 'running', attempts: FieldValue.increment(1), startedAt: FieldValue.serverTimestamp() })

  // 이미 받은 결과가 있으면 다시 호출하지 않는다 (재시도 무과금)
  let result = job.get('providerResult') as string | undefined
  if (!result) {
    const out = await fakeText.generate({ system: '', prompt: JSON.stringify(job.get('params')) })
    result = out.text
    await ref.update({ providerResult: result, providerRequestId: out.requestId })
  }

  await db.runTransaction(async (tx) => {
    const cost = 0
    settle(tx, workspaceId, job.get('month'), job.get('estimateKrw') ?? 0, cost, job.get('target')?.episodeId)
    tx.update(ref, { status: 'succeeded', costKrw: cost, finishedAt: FieldValue.serverTimestamp() })
  })
})
