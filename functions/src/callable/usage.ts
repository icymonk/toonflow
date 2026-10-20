import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { ERROR_KEYS } from '../../../shared/callables'
import { asPlan, planCapKrw, setWorkspaceLimitInput } from '../../../shared/usage'
import { requireMember } from '../lib/authz'
import { authedCallable } from '../lib/callable'

/** AIU-20: 월 한도 바꾸기 (소유자·관리자). 요금제 상한까지만 (AIU-24) */
export const setWorkspaceLimit = authedCallable(setWorkspaceLimitInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'admin')
  const db = getFirestore()
  const [ws, limits] = await Promise.all([db.doc(`workspaces/${data.workspaceId}`).get(), db.doc('config/limits').get()])
  if (data.monthlyLimitKrw > planCapKrw(asPlan(ws.get('plan')), limits.data())) throw new HttpsError('invalid-argument', ERROR_KEYS.overPlan)
  await ws.ref.update({ monthlyLimitKrw: data.monthlyLimitKrw })
  return { ok: true as const }
})
