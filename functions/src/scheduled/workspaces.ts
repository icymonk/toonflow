import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'

/** ACC-06·13: 유예가 끝난 워크스페이스(7일)와 계정(30일)을 매일 지운다 */
export const purgeDeleted = onSchedule({ schedule: 'every day 04:30', timeZone: 'Asia/Seoul' }, async () => {
  const db = getFirestore()
  const now = Timestamp.now()
  for (const ws of (await db.collection('workspaces').where('deleteAt', '<', now).get()).docs) {
    // 멤버들의 목록에서 빼고, 지금 열린 워크스페이스였으면 남은 것으로 바꾼다
    for (const m of (await ws.ref.collection('members').get()).docs) {
      const u = await db.doc(`users/${m.id}`).get()
      if (!u.exists) continue
      const rest = ((u.get('workspaceIds') as string[] | undefined) ?? []).filter(id => id !== ws.id)
      await u.ref.update({ workspaceIds: rest, ...(u.get('workspaceId') === ws.id ? { workspaceId: rest[0] ?? FieldValue.delete() } : {}) })
    }
    await getStorage().bucket().deleteFiles({ prefix: `workspaces/${ws.id}/` }).catch(e => logger.warn('storage purge failed', { ws: ws.id, e: String(e) }))
    await db.recursiveDelete(ws.ref)
  }
  for (const u of (await db.collection('users').where('purgeAt', '<', now).get()).docs) {
    await getAuth().deleteUser(u.id).catch(e => logger.warn('auth delete failed', { uid: u.id, e: String(e) }))
    await db.recursiveDelete(u.ref)
  }
})
