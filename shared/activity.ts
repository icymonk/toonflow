import { z } from 'zod'

/** CMN-31 워크스페이스 활동 기록 · CMN-51 전체 현황 · CMN-54 운영자 열람 기록 */
export const ACTIVITY_ACTIONS = ['invite.create', 'invite.accept', 'member.role', 'member.remove', 'member.leave', 'workspace.delete', 'workspace.restore', 'workspace.transfer'] as const
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number]
export interface Activity { id: string, uid: string, action: ActivityAction, meta?: Record<string, string | number | null>, at?: { toMillis: () => number } }

export const adminOverviewInput = z.object({})
export type AdminOverviewInput = z.infer<typeof adminOverviewInput>
export interface OverviewRow { id: string, name: string, ownerId: string, spentKrw: number, deleteAt: number | null }
export interface AdminOverview { month: string, workspaces: number, spentKrw: number, jobs: number, failed: number, byModel: Record<string, { total: number, failed: number }>, rows: OverviewRow[] }

export const logAdminViewInput = z.object({ workspaceId: z.string().min(1).max(40), reason: z.string().trim().min(1).max(200) })
export type LogAdminViewInput = z.infer<typeof logAdminViewInput>
export interface AdminView { id: string, by: string, email: string | null, reason: string, workspaceId?: string, at?: { toMillis: () => number } }

/** 실패율(%) — 끝난 작업 중 실패 */
export const failRate = (jobs: number, failed: number) => (jobs ? Math.round((failed / jobs) * 1000) / 10 : 0)
