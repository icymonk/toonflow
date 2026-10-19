import type { Role } from './roles'
import { z } from 'zod'

/** ACC-20~23·AIU-22: 초대 링크, 역할 변경·내보내기, 나가기, 멤버별 한도 */
export const INVITE_ROLES = ['admin', 'editor', 'viewer'] as const
export type InviteRole = (typeof INVITE_ROLES)[number]
export const INVITE_DAYS = [1, 7, 30] as const

const wsId = z.string().min(1).max(40)
const uid = z.string().min(1).max(128)
export const createInviteInput = z.object({ workspaceId: wsId, role: z.enum(INVITE_ROLES), days: z.union([z.literal(1), z.literal(7), z.literal(30)]) })
export type CreateInviteInput = z.infer<typeof createInviteInput>
export const inviteTokenInput = z.object({ token: z.string().regex(/^[\w-]{20,64}$/) })
export type InviteTokenInput = z.infer<typeof inviteTokenInput>
export const revokeInviteInput = z.object({ workspaceId: wsId, inviteId: z.string().min(1).max(64) })
export type RevokeInviteInput = z.infer<typeof revokeInviteInput>
export const setMemberRoleInput = z.object({ workspaceId: wsId, uid, role: z.enum(INVITE_ROLES) })
export type SetMemberRoleInput = z.infer<typeof setMemberRoleInput>
export const memberRefInput = z.object({ workspaceId: wsId, uid })
export type MemberRefInput = z.infer<typeof memberRefInput>
export const setMemberLimitInput = z.object({ workspaceId: wsId, uid, monthlyLimitKrw: z.number().int().min(0).max(10_000_000).nullable() })
export type SetMemberLimitInput = z.infer<typeof setMemberLimitInput>

type Ts = { toMillis: () => number }
export interface Member { id: string, role: Role, email?: string | null, displayName?: string | null, joinedAt?: Ts, lastActiveAt?: Ts | null, monthlyLimitKrw?: number | null }
export interface InviteInfo { workspaceName: string, role: InviteRole, expiresAt: number }

/** 소유자는 소유자 밖의 역할을, 관리자는 편집자·보기 전용만 줄 수 있다 */
export function assignable(actor: Role): InviteRole[] {
  return actor === 'owner' ? ['admin', 'editor', 'viewer'] : actor === 'admin' ? ['editor', 'viewer'] : []
}
/** 소유자는 아무도 바꿀 수 없고(넘기기는 ACC-14), 관리자는 다른 관리자를 바꿀 수 없다 */
export const canChangeMember = (actor: Role, target: Role) => target !== 'owner' && (actor === 'owner' || (actor === 'admin' && target !== 'admin'))
