import type { Role } from '../../../shared/roles'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { ERROR_KEYS } from '../../../shared/callables'
import { atLeast, ROLES } from '../../../shared/roles'

/** 역할이 min 이상인지 확인. 멤버가 아니면 notMember, 역할이 낮으면 forbidden */
export function assertRole(role: Role | null, min: Role): Role {
  if (role == null) throw new HttpsError('permission-denied', ERROR_KEYS.notMember)
  if (!atLeast(role, min)) throw new HttpsError('permission-denied', ERROR_KEYS.forbidden)
  return role
}

/**
 * 클라이언트가 보낸 워크스페이스 id를 믿지 않고 members/{uid}로 실제 역할을 확인한다
 * (원본 기획 7-2, docs/dev/functions.md 1절).
 */
export async function requireMember(wsId: string, uid: string, min: Role = 'viewer'): Promise<Role> {
  const snap = await getFirestore().doc(`workspaces/${wsId}/members/${uid}`).get()
  const role = snap.get('role') as unknown
  return assertRole(ROLES.includes(role as Role) ? (role as Role) : null, min)
}
