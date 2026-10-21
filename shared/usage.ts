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

/** AIU-21: 사용 내역을 묶어 보기 위한 AI 작업의 최소 모양 */
export interface UsageJobLike { type: string, costKrw?: number, requestedBy?: string, target?: { episodeId?: string }, createdAt?: { toMillis: () => number } }
export interface UsageGroup { key: string, krw: number, count: number }

/** 한국 시간 기준 그 달의 날짜 (1~31) */
export const kstDay = (ms: number) => new Date(ms + 9 * 60 * 60 * 1000).getUTCDate()

/** 이전 n달의 월 키 (이번 달부터) */
export function recentMonths(n: number, now: Date = new Date()): string[] {
  const k = monthKey(now)
  const y = Number(k.slice(0, 4))
  const m = Number(k.slice(4)) - 1
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - i, 1))
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  })
}

/** AIU-21: 금액이 큰 순으로 묶는다. 키가 없는 작업은 '' 묶음 */
export function groupUsage<T extends UsageJobLike>(jobs: T[], key: (j: T) => string | undefined): UsageGroup[] {
  const m = new Map<string, UsageGroup>()
  for (const j of jobs) {
    const k = key(j) ?? ''
    const g = m.get(k) ?? { key: k, krw: 0, count: 0 }
    g.krw += j.costKrw ?? 0
    g.count++
    m.set(k, g)
  }
  return [...m.values()].sort((a, b) => b.krw - a.krw || b.count - a.count)
}

/** AIU-21: 그 달 일별 금액. 길이는 그 달 날 수 */
export function dailyUsage(jobs: UsageJobLike[], month: string): number[] {
  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(4)), 0)).getUTCDate()
  const out = Array.from({ length: days }, () => 0)
  for (const j of jobs) {
    const ms = j.createdAt?.toMillis()
    if (ms != null) out[kstDay(ms) - 1]! += j.costKrw ?? 0
  }
  return out
}
