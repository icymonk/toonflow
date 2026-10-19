import type { ActivityAction } from '../../../shared/activity'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

/** CMN-31: 서버 기능이 남기는 활동 기록. 실패해도 본 작업은 막지 않는다 */
export async function logActivity(wsId: string, uid: string, action: ActivityAction, meta: Record<string, string | number | null> = {}) {
  await getFirestore().collection(`workspaces/${wsId}/activity`).add({ uid, action, meta, at: FieldValue.serverTimestamp() }).catch(() => {})
}
