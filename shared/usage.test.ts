import { describe, expect, it } from 'vitest'
import { asPlan, dailyUsage, effectiveLimitKrw, formatKrw, groupUsage, monthKey, planCapKrw, recentMonths, remainingKrw, usageLevel, usageRatio } from './usage'

describe('usage', () => {
  it('caps the workspace limit at the plan and adds this month\'s credit (AIU-24)', () => {
    expect(planCapKrw('free', undefined)).toBe(50000)
    expect(planCapKrw('pro', { planLimitsKrw: { basic: 1, pro: 900 } })).toBe(900)
    expect(effectiveLimitKrw({ plan: 'free' })).toBe(50000)
    expect(effectiveLimitKrw({ plan: 'free', wsLimitKrw: 200000 })).toBe(50000)
    expect(effectiveLimitKrw({ plan: 'basic', wsLimitKrw: 20000, creditKrw: 5000 })).toBe(25000)
    expect(effectiveLimitKrw({ plan: 'pro', creditKrw: 10000 })).toBe(510000)
    expect(asPlan('enterprise')).toBe('free')
  })
  it('uses the Korean month', () => {
    expect(monthKey(new Date('2026-10-31T15:30:00Z'))).toBe('202611')
    expect(monthKey(new Date('2026-10-31T14:30:00Z'))).toBe('202610')
  })

  it('counts reserved as used', () => {
    expect(usageRatio(50000, { spentKrw: 30000, reservedKrw: 10000 })).toBe(0.8)
    expect(remainingKrw(50000, { spentKrw: 45000, reservedKrw: 10000 })).toBe(0)
  })

  it('warns at 80% and blocks at 100%', () => {
    expect(usageLevel(0.5)).toBe('ok')
    expect(usageLevel(0.8)).toBe('warn')
    expect(usageLevel(1)).toBe('blocked')
  })

  it('formats won', () => {
    expect(formatKrw(50000)).toBe('₩50,000')
  })
})

describe('usage breakdown', () => {
  const at = (iso: string) => ({ toMillis: () => Date.parse(iso) })
  const jobs = [
    { type: 'panel.image', costKrw: 300, requestedBy: 'a', target: { episodeId: 'e1' }, createdAt: at('2026-10-01T15:30:00Z') },
    { type: 'story.draft', costKrw: 20, requestedBy: 'b', target: { episodeId: 'e1' }, createdAt: at('2026-10-02T01:00:00Z') },
    { type: 'panel.image', costKrw: 0, requestedBy: 'a', createdAt: at('2026-10-31T14:00:00Z') },
  ]
  it('groups by key, biggest first', () => {
    expect(groupUsage(jobs, j => j.type)).toEqual([{ key: 'panel.image', krw: 300, count: 2 }, { key: 'story.draft', krw: 20, count: 1 }])
    expect(groupUsage(jobs, j => j.target?.episodeId)).toEqual([{ key: 'e1', krw: 320, count: 2 }, { key: '', krw: 0, count: 1 }])
  })
  it('daily in KST', () => {
    const d = dailyUsage(jobs, '202610')
    expect(d).toHaveLength(31)
    expect(d[1]).toBe(320)
    expect(d[0]).toBe(0)
  })
  it('recent months', () => {
    expect(recentMonths(3, new Date('2026-01-15T00:00:00Z'))).toEqual(['202601', '202512', '202511'])
  })
})
