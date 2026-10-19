import { z } from 'zod'
import { SLUG_RE } from './intake'

/** CMN-40·53 신고와 신고 처리 */
export const REPORT_REASONS = ['spam', 'abuse', 'privacy', 'illegal', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]
export const REPORT_ACTIONS = ['block', 'unblock', 'dismiss'] as const
export type ReportAction = (typeof REPORT_ACTIONS)[number]

const reason = z.enum(REPORT_REASONS)
const detail = z.string().trim().max(500)
export const reportPageInput = z.object({ slug: z.string().regex(SLUG_RE), reason, detail })
export type ReportPageInput = z.infer<typeof reportPageInput>
export const reportSubmissionInput = z.object({ workspaceId: z.string().min(1).max(40), submissionId: z.string().min(1).max(40), reason, detail })
export type ReportSubmissionInput = z.infer<typeof reportSubmissionInput>
export const resolveReportInput = z.object({ reportId: z.string().min(1).max(40), action: z.enum(REPORT_ACTIONS), note: z.string().trim().max(300) })
export type ResolveReportInput = z.infer<typeof resolveReportInput>

type Ts = { toMillis: () => number }
export interface Report {
  id: string
  kind: 'page' | 'submission'
  slug: string
  workspaceId: string
  submissionId?: string
  reason: ReportReason
  detail: string
  status: 'open' | 'resolved'
  by: string | null
  action?: ReportAction
  note?: string
  resolvedBy?: string
  /** 처리할 때마다 쌓이는 기록 */
  log?: { action: ReportAction, note: string, by: string, at: number }[]
  createdAt?: Ts
  resolvedAt?: Ts
}
