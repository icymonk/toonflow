import { logger } from 'firebase-functions'
import { getFirestore } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { needsRefresh } from '../../../shared/instagram'
import { refreshToken } from '../lib/instagram'

/** PUB-24: 60일 토큰을 만료 20일 전부터 매일 갱신한다. 실패하면 다음 날 다시 */
export const refreshInstagramTokens = onSchedule({ schedule: 'every day 05:00', timeZone: 'Asia/Seoul' }, async () => {
  const db = getFirestore()
  const now = Date.now()
  for (const d of (await db.collection('instagramTokens').get()).docs) {
    if (!needsRefresh(d.get('expiresAt'), d.get('issuedAt'), now)) continue
    try {
      const t = await refreshToken(d.get('accessToken'))
      const expiresAt = now + t.expiresIn * 1000
      await d.ref.update({ accessToken: t.accessToken, issuedAt: now, expiresAt })
      await db.doc(`workspaces/${d.id}`).update({ 'instagram.expiresAt': expiresAt })
    }
    catch (e) { logger.warn('instagram refresh failed', { ws: d.id, e: String(e) }) }
  }
})
