/** CMN-02 오늘 할 일 · CMN-03 이번 달 현황 */
interface Ts { toMillis: () => number }
interface EpLike { id: string, step: string, status: string, archivedAt?: Ts | null, createdAt?: Ts, costKrw?: number, published?: { at?: Ts } | null, settings?: { plannedAt?: string | null } }

const monthStart = (now: Date) => new Date(now.getFullYear(), now.getMonth(), 1).getTime()

export function monthStats(eps: EpLike[], now = new Date()) {
  const from = monthStart(now)
  const created = eps.filter(e => (e.createdAt?.toMillis() ?? 0) >= from)
  const published = eps.filter(e => (e.published?.at?.toMillis() ?? 0) >= from)
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  return {
    created: created.length,
    published: published.length,
    avgCostKrw: Math.round(avg(published.map(e => e.costKrw ?? 0))),
    avgHours: Math.round(avg(published.filter(e => e.createdAt).map(e => (e.published!.at!.toMillis() - e.createdAt!.toMillis()) / 3_600_000)) * 10) / 10,
  }
}

export function todayTasks(eps: EpLike[], subs: { status: string }[], failedJobs: number) {
  const live = eps.filter(e => !e.archivedAt && e.status === 'active')
  return {
    newSubs: subs.filter(s => s.status === 'new').length,
    review: live.filter(e => e.step === 'review' || e.step === 'export').map(e => e.id),
    illustrate: live.filter(e => e.step === 'illustrate').map(e => e.id),
    failedJobs,
    /** PUB-23 게시 예정일 메모 (빠른 날짜 순) */
    planned: eps.filter(e => !e.archivedAt && !e.published && e.settings?.plannedAt).map(e => ({ id: e.id, date: e.settings!.plannedAt! })).sort((a, b) => a.date.localeCompare(b.date)),
  }
}
