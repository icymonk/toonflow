import { z } from 'zod'

/** CMN-41·52: 랜딩 대기 명단 → 운영자 승인 → 가입 허용 목록 */
export const WAITLIST_STATUSES = ['pending', 'approved', 'rejected'] as const
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number]
export const WAITLIST_ACTIONS = ['approve', 'reject'] as const
export type WaitlistAction = (typeof WAITLIST_ACTIONS)[number]

export const joinWaitlistInput = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().min(1).max(40),
  handle: z.string().trim().max(60),
  note: z.string().trim().max(500),
  agree: z.literal(true),
  /** 사람에게는 안 보이는 칸. 채워져 있으면 봇으로 보고 조용히 버린다 */
  website: z.string().max(200).nullish(),
})
export type JoinWaitlistInput = z.infer<typeof joinWaitlistInput>

export const decideWaitlistInput = z.object({ id: z.string().min(1).max(64), action: z.enum(WAITLIST_ACTIONS) })
export type DecideWaitlistInput = z.infer<typeof decideWaitlistInput>

export interface WaitlistEntry {
  id: string
  email: string
  name: string
  handle: string
  note: string
  status: WaitlistStatus
  createdAt?: { toMillis: () => number }
  decidedAt?: { toMillis: () => number }
  decidedBy?: string
}
