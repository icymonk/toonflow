import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { isStalled } from '../../../shared/jobs'
import { settle } from '../lib/usage'

/** AIU-03: 서버가 멈춰 오래 "진행 중"으로 남은 작업을 실패로 돌리고 예약을 푼다. 다시 시도할 수 있다 */
export const failStalledJobs = onSchedule({ schedule: 'every 10 minutes', timeZone: 'Asia/Seoul' }, async () => {
  const db = getFirestore()
  for (const ws of await db.collection('workspaces').listDocuments()) {
    const snap = await ws.collection('aiJobs').where('status', '==', 'running').get()
    for (const d of snap.docs) {
      if (!isStalled(d.get('status'), d.get('startedAt')?.toMillis(), Date.now())) continue
      await db.runTransaction(async (tx) => {
        const job = await tx.get(d.ref)
        if (!isStalled(job.get('status'), job.get('startedAt')?.toMillis(), Date.now())) return
        settle(tx, ws.id, job.get('month'), job.get('estimateKrw') ?? 0, 0)
        tx.update(d.ref, { status: 'failed', error: { code: 'provider_error', message: 'stalled', retryable: true }, finishedAt: FieldValue.serverTimestamp() })
      })
      logger.warn('stalled ai job failed', { workspaceId: ws.id, jobId: d.id })
    }
  }
})
