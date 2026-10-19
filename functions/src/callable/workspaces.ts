import type { DocumentReference } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { ERROR_KEYS } from '../../../shared/callables'
import { defaultWorkspaceName } from '../../../shared/account'
import { ACCOUNT_DELETE_DAYS, createWorkspaceInput, daysLater, deleteAccountInput, MAX_OWNED_WORKSPACES, transferOwnershipInput, userWorkspaceIds, workspaceRefInput, WS_DELETE_DAYS } from '../../../shared/workspaces'
import { logActivity } from '../lib/activity'
import { requireMember } from '../lib/authz'
import { authedCallable } from '../lib/callable'

const memberInfo = (token: { email?: unknown, name?: unknown }) => ({
  email: typeof token.email === 'string' ? token.email : null,
  displayName: typeof token.name === 'string' ? token.name : null,
})

async function userDoc(uid: string) {
  const snap = await getFirestore().doc(`users/${uid}`).get()
  if (!snap.exists) throw new HttpsError('failed-precondition', ERROR_KEYS.notAllowed)
  return snap
}

/** ACC-12: 새 워크스페이스. 만든 사람이 소유자, 바로 그 워크스페이스로 연다 */
export const createWorkspace = authedCallable(createWorkspaceInput, async ({ uid, token, data }) => {
  const db = getFirestore()
  const user = await userDoc(uid)
  const ids = userWorkspaceIds(user.data() ?? {})
  const owned = (await Promise.all(ids.map(id => db.doc(`workspaces/${id}`).get()))).filter(w => w.get('ownerId') === uid)
  if (owned.length >= MAX_OWNED_WORKSPACES) throw new HttpsError('resource-exhausted', ERROR_KEYS.tooManyWorkspaces)
  const wsRef = db.collection('workspaces').doc()
  const now = FieldValue.serverTimestamp()
  const batch = db.batch()
  batch.set(wsRef, { name: data.name || defaultWorkspaceName(null, null), ownerId: uid, defaults: {}, deleteAt: null, createdAt: now })
  batch.set(wsRef.collection('members').doc(uid), { role: 'owner', joinedAt: now, ...memberInfo(token) })
  batch.update(user.ref, { workspaceIds: [...ids, wsRef.id], workspaceId: wsRef.id })
  await batch.commit()
  return { workspaceId: wsRef.id }
})

/** ACC-12: 전환. 마지막으로 연 워크스페이스는 users/{uid}.workspaceId */
export const switchWorkspace = authedCallable(workspaceRefInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid)
  await getFirestore().doc(`users/${uid}`).update({ workspaceId: data.workspaceId, workspaceIds: FieldValue.arrayUnion(data.workspaceId) })
  return { ok: true as const }
})

/** ACC-13: 소유자만. 7일 유예(deleteAt) 뒤 매일 정리에서 지운다. 마지막 남은 워크스페이스는 못 지운다 */
export const deleteWorkspace = authedCallable(workspaceRefInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'owner')
  const db = getFirestore()
  const user = await userDoc(uid)
  const others = (await Promise.all(userWorkspaceIds(user.data() ?? {}).filter(id => id !== data.workspaceId).map(id => db.doc(`workspaces/${id}`).get())))
    .filter(w => w.exists && !w.get('deleteAt'))
  if (!others.length) throw new HttpsError('failed-precondition', ERROR_KEYS.lastWorkspace)
  const deleteAt = Timestamp.fromMillis(daysLater(Date.now(), WS_DELETE_DAYS))
  await db.doc(`workspaces/${data.workspaceId}`).update({ deleteAt, deletedBy: uid })
  if (user.get('workspaceId') === data.workspaceId) await user.ref.update({ workspaceId: others[0]!.id })
  await logActivity(data.workspaceId, uid, 'workspace.delete')
  return { deleteAt: deleteAt.toMillis() }
})

/** ACC-13: 유예 중 복구 */
export const restoreWorkspace = authedCallable(workspaceRefInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'owner')
  await getFirestore().doc(`workspaces/${data.workspaceId}`).update({ deleteAt: null, deletedBy: FieldValue.delete() })
  await logActivity(data.workspaceId, uid, 'workspace.restore')
  return { ok: true as const }
})

/** ACC-14: 관리자에게 넘긴다. 넘긴 사람은 관리자가 된다 */
export const transferOwnership = authedCallable(transferOwnershipInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'owner')
  const db = getFirestore()
  const ws = db.doc(`workspaces/${data.workspaceId}`)
  await db.runTransaction(async (tx) => {
    const target = await tx.get(ws.collection('members').doc(data.toUid))
    if (target.get('role') !== 'admin') throw new HttpsError('failed-precondition', ERROR_KEYS.notAdminTarget)
    tx.update(target.ref, { role: 'owner' })
    tx.update(ws.collection('members').doc(uid), { role: 'admin' })
    tx.update(ws, { ownerId: data.toUid })
  })
  await logActivity(data.workspaceId, uid, 'workspace.transfer', { target: data.toUid })
  return { ok: true as const }
})

/** ACC-06: 소유한 워크스페이스(삭제 예약 제외)가 없을 때만. 멤버십을 풀고 로그인을 막은 뒤 30일 뒤 지운다 */
export const deleteAccount = authedCallable(deleteAccountInput, async ({ uid }) => {
  const db = getFirestore()
  const user = await userDoc(uid)
  const refs: DocumentReference[] = []
  for (const id of userWorkspaceIds(user.data() ?? {})) {
    const [ws, m] = await Promise.all([db.doc(`workspaces/${id}`).get(), db.doc(`workspaces/${id}/members/${uid}`).get()])
    if (m.get('role') === 'owner' && ws.exists && !ws.get('deleteAt')) throw new HttpsError('failed-precondition', ERROR_KEYS.ownsWorkspace)
    if (m.exists && m.get('role') !== 'owner') refs.push(m.ref)
  }
  const batch = db.batch()
  for (const r of refs) batch.delete(r)
  batch.update(user.ref, { deletedAt: FieldValue.serverTimestamp(), purgeAt: Timestamp.fromMillis(daysLater(Date.now(), ACCOUNT_DELETE_DAYS)) })
  await batch.commit()
  await getAuth().updateUser(uid, { disabled: true })
  return { ok: true as const }
})
