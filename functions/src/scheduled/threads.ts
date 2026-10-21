import { logger } from 'firebase-functions'
import { getFirestore } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { needsRefresh } from '../../../shared/threads'
import { refreshToken } from '../lib/threads'

/** PUB-25: 60일 토큰을 만료 20일 전부터 매일 갱신한다. 실패하면 다음 날 다시 */
export const refreshThreadsTokens = onSchedule({ schedule: 'every day 05:10', timeZone: 'Asia/Seoul' }, async () => {
  const db = getFirestore()
  const now = Date.now()
  for (const d of (await db.collection('threadsTokens').get()).docs) {
    if (!needsRefresh(d.get('expiresAt'), d.get('issuedAt'), now)) continue
    try {
      const t = await refreshToken(d.get('accessToken'))
      const expiresAt = now + t.expiresIn * 1000
      await d.ref.update({ accessToken: t.accessToken, issuedAt: now, expiresAt })
      await db.doc(`workspaces/${d.id}`).update({ 'threads.expiresAt': expiresAt })
    }
    catch (e) { logger.warn('threads refresh failed', { ws: d.id, e: String(e) }) }
  }
})
