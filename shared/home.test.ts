import { describe, expect, it } from 'vitest'
import { monthStats, todayTasks } from './home'

const ts = (iso: string) => ({ toMillis: () => new Date(iso).getTime() })
const now = new Date('2026-10-19T12:00:00')

describe('monthStats', () => {
  it('counts this month and averages published cost and hours', () => {
    const s = monthStats([
      { id: 'a', step: 'export', status: 'published', createdAt: ts('2026-10-01T00:00:00'), costKrw: 1000, published: { at: ts('2026-10-01T10:00:00') } },
      { id: 'b', step: 'story', status: 'active', createdAt: ts('2026-09-30T00:00:00'), costKrw: 3000, published: { at: ts('2026-10-02T00:00:00') } },
      { id: 'c', step: 'story', status: 'active', createdAt: ts('2026-09-01T00:00:00') },
    ], now)
    expect(s).toEqual({ created: 1, published: 2, avgCostKrw: 2000, avgHours: 29 })
  })
})

describe('todayTasks', () => {
  it('skips archived and finished episodes', () => {
    const t = todayTasks([
      { id: 'a', step: 'review', status: 'active' },
      { id: 'b', step: 'review', status: 'done' },
      { id: 'c', step: 'illustrate', status: 'active', archivedAt: ts('2026-10-01') },
    ], [{ status: 'new' }, { status: 'accepted' }], 2)
    expect(t).toEqual({ newSubs: 1, review: ['a'], illustrate: [], failedJobs: 2, planned: [] })
  })
  it('lists planned dates of unpublished episodes, earliest first (PUB-23)', () => {
    const t = todayTasks([
      { id: 'a', step: 'export', status: 'done', settings: { plannedAt: '2026-11-03' } },
      { id: 'b', step: 'export', status: 'done', settings: { plannedAt: '2026-11-01' } },
      { id: 'c', step: 'export', status: 'published', published: { at: ts('2026-10-01') }, settings: { plannedAt: '2026-10-01' } },
    ], [], 0)
    expect(t.planned).toEqual([{ id: 'b', date: '2026-11-01' }, { id: 'a', date: '2026-11-03' }])
  })
})
