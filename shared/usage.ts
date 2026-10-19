import { z } from 'zod'

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

export function formatKrw(n: number): string {
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}
