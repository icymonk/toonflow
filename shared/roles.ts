// 워크스페이스 역할과 권한: docs/planning/users-and-roles.md
export const ROLES = ['owner', 'admin', 'editor', 'viewer'] as const
export type Role = (typeof ROLES)[number]

const rank: Record<Role, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 }

export function atLeast(role: Role | null | undefined, min: Role): boolean {
  return role != null && rank[role] >= rank[min]
}

export const canEdit = (role: Role | null | undefined) => atLeast(role, 'editor')
export const canRunAi = canEdit
export const canManage = (role: Role | null | undefined) => atLeast(role, 'admin')
