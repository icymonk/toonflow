/** CMN-60~63 사용자 피드백 */
export const FEEDBACK_KINDS = ['bug', 'idea', 'question', 'other'] as const
export type FeedbackKind = typeof FEEDBACK_KINDS[number]
export const FEEDBACK_STATUSES = ['open', 'answered', 'closed'] as const
export type FeedbackStatus = typeof FEEDBACK_STATUSES[number]
export const FEEDBACK_MAX = 2000

interface Ts { toMillis: () => number }
export interface Feedback {
  id: string
  uid: string
  email: string
  name: string
  workspaceId: string | null
  kind: FeedbackKind
  text: string
  path: string
  status: FeedbackStatus
  createdAt?: Ts
  updatedAt?: Ts
  adminReplyAt?: Ts
  userReplyAt?: Ts
}
export interface FeedbackReply {
  id: string
  by: 'user' | 'admin'
  uid: string
  text: string
  createdAt?: Ts
}

/** 운영자 답변이 마지막으로 본 시각보다 나중이면 새 답변 */
export const hasNewReply = (f: Pick<Feedback, 'adminReplyAt'>, seenAt: number) => (f.adminReplyAt?.toMillis() ?? 0) > seenAt

/** 최근 활동 순: 답변·댓글·만든 시각 중 가장 늦은 것 */
export const lastActivity = (f: Pick<Feedback, 'createdAt' | 'adminReplyAt' | 'userReplyAt'>) =>
  Math.max(f.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER, f.adminReplyAt?.toMillis() ?? 0, f.userReplyAt?.toMillis() ?? 0)
