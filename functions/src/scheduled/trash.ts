import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { TRASH_COLLECTION, TRASH_KINDS, trashCutoff } from '../../../shared/trash'

/** CMN-30: 휴지통에서 30일 지난 것을 매일 지운다 */
export const purgeExpiredTrash = onSchedule({ schedule: 'every day 04:00', timeZone: 'Asia/Seoul' }, async () => {
  const db = getFirestore()
  const cutoff = Timestamp.fromMillis(trashCutoff(Date.now()))
  for (const ws of await db.collection('workspaces').listDocuments()) {
    for (const kind of TRASH_KINDS) {
      const snap = await ws.collection(TRASH_COLLECTION[kind]).where('deletedAt', '<', cutoff).get()
      for (const d of snap.docs) await db.recursiveDelete(d.ref)
    }
  }
})
