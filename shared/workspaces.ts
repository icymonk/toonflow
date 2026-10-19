import { z } from 'zod'

/** ACC-06·12~14: 워크스페이스 여러 개·삭제·소유권 이전·계정 삭제 */
export const WS_DELETE_DAYS = 7
export const ACCOUNT_DELETE_DAYS = 30
export const MAX_OWNED_WORKSPACES = 10
const DAY = 24 * 60 * 60 * 1000
export const daysLater = (now: number, days: number) => now + days * DAY

export const createWorkspaceInput = z.object({ name: z.string().trim().min(1).max(40) })
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInput>
export const workspaceRefInput = z.object({ workspaceId: z.string().min(1).max(40) })
export type WorkspaceRefInput = z.infer<typeof workspaceRefInput>
export const transferOwnershipInput = z.object({ workspaceId: z.string().min(1).max(40), toUid: z.string().min(1).max(128) })
export type TransferOwnershipInput = z.infer<typeof transferOwnershipInput>
export const deleteAccountInput = z.object({})
export type DeleteAccountInput = z.infer<typeof deleteAccountInput>

/** users/{uid}의 워크스페이스 목록. 4-B 전 계정은 workspaceId 하나만 있다 */
export const userWorkspaceIds = (u: { workspaceId?: string | null, workspaceIds?: string[] | null }) =>
  [...new Set([...(u.workspaceIds ?? []), ...(u.workspaceId ? [u.workspaceId] : [])])]
