import { getFirestore } from 'firebase-admin/firestore'
import { setWorkspaceLimitInput } from '../../../shared/usage'
import { requireMember } from '../lib/authz'
import { authedCallable } from '../lib/callable'

/** AIU-20: 월 한도 바꾸기 (소유자·관리자) */
export const setWorkspaceLimit = authedCallable(setWorkspaceLimitInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'admin')
  await getFirestore().doc(`workspaces/${data.workspaceId}`).update({ monthlyLimitKrw: data.monthlyLimitKrw })
  return { ok: true as const }
})
