import type { InviteRole } from '../../../shared/members'
import type { Role } from '../../../shared/roles'
import { createHash, randomBytes } from 'node:crypto'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { ERROR_KEYS } from '../../../shared/callables'
import { assignable, canChangeMember, createInviteInput, inviteTokenInput, memberRefInput, revokeInviteInput, setMemberLimitInput, setMemberRoleInput } from '../../../shared/members'
import { userWorkspaceIds, workspaceRefInput } from '../../../shared/workspaces'
import { requireMember } from '../lib/authz'
import { authedCallable } from '../lib/callable'

const hash = (t: string) => createHash('sha256').update(t).digest('hex')
const DAY = 24 * 60 * 60 * 1000
const forbidden = () => new HttpsError('permission-denied', ERROR_KEYS.forbidden)

async function liveInvite(token: string) {
  const snap = await getFirestore().doc(`invites/${hash(token)}`).get()
  if (!snap.exists || (snap.get('expiresAt') as Timestamp).toMillis() < Date.now()) throw new HttpsError('not-found', ERROR_KEYS.tokenNotFound)
  return snap
}

/** 멤버를 빼면 그 사람의 목록에서도 빼고, 열려 있던 워크스페이스였으면 남은 것으로 */
async function detachUser(uid: string, wsId: string) {
  const u = await getFirestore().doc(`users/${uid}`).get()
  if (!u.exists) return
  const rest = userWorkspaceIds(u.data() ?? {}).filter(id => id !== wsId)
  await u.ref.update({ workspaceIds: rest, ...(u.get('workspaceId') === wsId ? { workspaceId: rest[0] ?? FieldValue.delete() } : {}) })
}

/** 관리자 이상이 다른 멤버를 바꿀 수 있는지 (본인·소유자 제외, 관리자는 관리자를 못 바꿈) */
async function changeable(wsId: string, actorUid: string, targetUid: string) {
  const actor = await requireMember(wsId, actorUid, 'admin')
  if (actorUid === targetUid) throw forbidden()
  const ref = getFirestore().doc(`workspaces/${wsId}/members/${targetUid}`)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpsError('not-found', ERROR_KEYS.notMember)
  if (!canChangeMember(actor, snap.get('role') as Role)) throw forbidden()
  return { actor, ref }
}

/** ACC-20: 초대 링크. 토큰은 만들 때 한 번만 돌려주고 해시만 남긴다 */
export const createInvite = authedCallable(createInviteInput, async ({ uid, data }) => {
  const actor = await requireMember(data.workspaceId, uid, 'admin')
  if (!assignable(actor).includes(data.role)) throw forbidden()
  const token = randomBytes(24).toString('base64url')
  const expiresAt = Timestamp.fromMillis(Date.now() + data.days * DAY)
  await getFirestore().doc(`invites/${hash(token)}`).set({ workspaceId: data.workspaceId, role: data.role, expiresAt, createdBy: uid, usedCount: 0, createdAt: FieldValue.serverTimestamp() })
  return { token, expiresAt: expiresAt.toMillis() }
})

export const revokeInvite = authedCallable(revokeInviteInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'admin')
  const ref = getFirestore().doc(`invites/${data.inviteId}`)
  if ((await ref.get()).get('workspaceId') !== data.workspaceId) throw new HttpsError('not-found', ERROR_KEYS.tokenNotFound)
  await ref.delete()
  return { ok: true as const }
})

/** 초대 화면에 보여 줄 워크스페이스 이름·역할 (로그인 뒤) */
export const inviteInfo = authedCallable(inviteTokenInput, async ({ data }) => {
  const inv = await liveInvite(data.token)
  const ws = await getFirestore().doc(`workspaces/${inv.get('workspaceId')}`).get()
  if (!ws.exists || ws.get('deleteAt')) throw new HttpsError('not-found', ERROR_KEYS.tokenNotFound)
  return { workspaceName: ws.get('name') as string, role: inv.get('role') as InviteRole, expiresAt: (inv.get('expiresAt') as Timestamp).toMillis() }
})

/** 링크로 들어와 로그인하면 멤버. 가입 허용 목록과 관계없다(초대가 곧 허용). 처음이면 users 문서도 만든다 */
export const acceptInvite = authedCallable(inviteTokenInput, async ({ uid, token, data }) => {
  const db = getFirestore()
  const inv = await liveInvite(data.token)
  const wsId = inv.get('workspaceId') as string
  const email = typeof token.email === 'string' ? token.email : null
  const displayName = typeof token.name === 'string' ? token.name : null
  await db.runTransaction(async (tx) => {
    const [ws, member, user] = await Promise.all([tx.get(db.doc(`workspaces/${wsId}`)), tx.get(db.doc(`workspaces/${wsId}/members/${uid}`)), tx.get(db.doc(`users/${uid}`))])
    if (!ws.exists || ws.get('deleteAt')) throw new HttpsError('not-found', ERROR_KEYS.tokenNotFound)
    if (!member.exists) {
      tx.set(member.ref, { role: inv.get('role'), joinedAt: FieldValue.serverTimestamp(), email, displayName, invitedBy: inv.get('createdBy') ?? null })
      tx.update(inv.ref, { usedCount: FieldValue.increment(1) })
    }
    if (user.exists) tx.update(user.ref, { workspaceId: wsId, workspaceIds: [...new Set([...userWorkspaceIds(user.data() ?? {}), wsId])] })
    else tx.set(user.ref, { displayName: displayName ?? email?.split('@')[0] ?? '', email, photoURL: typeof token.picture === 'string' ? token.picture : null, workspaceId: wsId, workspaceIds: [wsId], createdAt: FieldValue.serverTimestamp() })
  })
  return { workspaceId: wsId }
})

/** ACC-21 */
export const setMemberRole = authedCallable(setMemberRoleInput, async ({ uid, data }) => {
  const { actor, ref } = await changeable(data.workspaceId, uid, data.uid)
  if (!assignable(actor).includes(data.role)) throw forbidden()
  await ref.update({ role: data.role })
  return { ok: true as const }
})

export const removeMember = authedCallable(memberRefInput, async ({ uid, data }) => {
  const { ref } = await changeable(data.workspaceId, uid, data.uid)
  await ref.delete()
  await detachUser(data.uid, data.workspaceId)
  return { ok: true as const }
})

/** ACC-23: 소유자는 넘긴 뒤에만 */
export const leaveWorkspace = authedCallable(workspaceRefInput, async ({ uid, data }) => {
  if ((await requireMember(data.workspaceId, uid)) === 'owner') throw new HttpsError('failed-precondition', ERROR_KEYS.ownerCannotLeave)
  await getFirestore().doc(`workspaces/${data.workspaceId}/members/${uid}`).delete()
  await detachUser(uid, data.workspaceId)
  return { ok: true as const }
})

/** AIU-22: 멤버 월 한도(원). null이면 워크스페이스 한도만 */
export const setMemberLimit = authedCallable(setMemberLimitInput, async ({ uid, data }) => {
  const { ref } = await changeable(data.workspaceId, uid, data.uid)
  await ref.update({ monthlyLimitKrw: data.monthlyLimitKrw })
  return { ok: true as const }
})
