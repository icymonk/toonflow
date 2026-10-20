import type { Transaction } from 'firebase-admin/firestore'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { asPlan, effectiveLimitKrw, monthKey } from '../../../shared/usage'

const db = () => getFirestore()
export const usageRef = (wsId: string, month = monthKey()) => db().doc(`workspaces/${wsId}/usage/${month}`)

/** 한도 안이면 예약하고 true. 트랜잭션 안에서 먼저 읽는다 */
export async function reserve(tx: Transaction, wsId: string, amountKrw: number, uid?: string): Promise<boolean> {
  const [ws, usage, limits, member] = await Promise.all([
    tx.get(db().doc(`workspaces/${wsId}`)),
    tx.get(usageRef(wsId)),
    tx.get(db().doc('config/limits')),
    uid ? tx.get(db().doc(`workspaces/${wsId}/members/${uid}`)) : Promise.resolve(null),
  ])
  const limit = effectiveLimitKrw({ plan: asPlan(ws.get('plan')), wsLimitKrw: ws.get('monthlyLimitKrw') as number | undefined, limits: limits.data(), creditKrw: usage.get('creditKrw') as number | undefined })
  const used = ((usage.get('spentKrw') as number | undefined) ?? 0) + ((usage.get('reservedKrw') as number | undefined) ?? 0)
  if (used + amountKrw > limit) return false
  // AIU-22: 멤버 한도는 이번 달 그 멤버가 쓴 금액으로 본다
  const memberLimit = member?.get('monthlyLimitKrw') as number | null | undefined
  if (uid && typeof memberLimit === 'number' && ((usage.get(`byMember.${uid}`) as number | undefined) ?? 0) + amountKrw > memberLimit) return false
  tx.set(usageRef(wsId), { reservedKrw: FieldValue.increment(amountKrw), jobCount: FieldValue.increment(1) }, { merge: true })
  return true
}

/** 작업이 끝나면 예약을 풀고 실제 비용을 더한다 */
export function settle(tx: Transaction, wsId: string, month: string, reservedKrw: number, costKrw: number, episodeId?: string, uid?: string) {
  tx.set(usageRef(wsId, month), { reservedKrw: FieldValue.increment(-reservedKrw), spentKrw: FieldValue.increment(costKrw), ...(uid && costKrw > 0 ? { byMember: { [uid]: FieldValue.increment(costKrw) } } : {}) }, { merge: true })
  if (episodeId && costKrw > 0) tx.set(db().doc(`workspaces/${wsId}/episodes/${episodeId}`), { costKrw: FieldValue.increment(costKrw) }, { merge: true })
}
