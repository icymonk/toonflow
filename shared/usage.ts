import type { LimitsConfig } from './config'
import { z } from 'zod'
import { DEFAULT_LIMITS } from './config'

/** AIU-20: 사용량 문서 키 `usage/{yyyymm}`. 한국 시간 기준 달 */
export function monthKey(date: Date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return `${kst.getUTCFullYear()}${String(kst.getUTCMonth() + 1).padStart(2, '0')}`
}

export interface UsageDoc {
  reservedKrw?: number
  spentKrw?: number
  jobCount?: number
}

/** 한도 대비 사용 비율(0~1+). 예약분도 쓴 것으로 본다 */
export function usageRatio(limitKrw: number, usage: UsageDoc | undefined): number {
  if (limitKrw <= 0) return 1
  return ((usage?.spentKrw ?? 0) + (usage?.reservedKrw ?? 0)) / limitKrw
}

export function remainingKrw(limitKrw: number, usage: UsageDoc | undefined): number {
  return Math.max(0, limitKrw - (usage?.spentKrw ?? 0) - (usage?.reservedKrw ?? 0))
}

/** AIU-20: 80%에서 경고, 100%면 새 작업을 막는다 */
export type UsageLevel = 'ok' | 'warn' | 'blocked'
export function usageLevel(ratio: number): UsageLevel {
  return ratio >= 1 ? 'blocked' : ratio >= 0.8 ? 'warn' : 'ok'
}

export const setWorkspaceLimitInput = z.object({
  workspaceId: z.string().min(1),
  monthlyLimitKrw: z.number().int().min(0).max(10_000_000),
})
export type SetWorkspaceLimitInput = z.infer<typeof setWorkspaceLimitInput>

/** AIU-24: 결제 연동 전에는 운영자가 요금제와 이번 달 추가 크레딧을 직접 준다 (open-questions #23) */
export const PLANS = ['free', 'basic', 'pro'] as const
export type Plan = (typeof PLANS)[number]
export const asPlan = (v: unknown): Plan => (PLANS as readonly unknown[]).includes(v) ? v as Plan : 'free'

/** 요금제가 허용하는 월 한도 상한 */
export function planCapKrw(plan: Plan, limits: Partial<LimitsConfig> | undefined): number {
  if (plan === 'free') return limits?.monthlyLimitKrw ?? DEFAULT_LIMITS.monthlyLimitKrw
  return limits?.planLimitsKrw?.[plan] ?? DEFAULT_LIMITS.planLimitsKrw[plan]
}

/** 실제 월 한도 = min(워크스페이스가 정한 한도, 요금제 상한) + 이번 달 추가 크레딧 */
export function effectiveLimitKrw(p: { plan: Plan, wsLimitKrw?: number | null, limits?: Partial<LimitsConfig>, creditKrw?: number }): number {
  const cap = planCapKrw(p.plan, p.limits)
  return Math.min(p.wsLimitKrw ?? cap, cap) + Math.max(0, p.creditKrw ?? 0)
}

export const grantPlanInput = z.object({
  workspaceId: z.string().min(1).max(40),
  plan: z.enum(PLANS),
  creditKrw: z.number().int().min(0).max(10_000_000),
})
export type GrantPlanInput = z.infer<typeof grantPlanInput>

export function formatKrw(n: number): string {
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}
