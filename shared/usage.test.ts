import { describe, expect, it } from 'vitest'
import { asPlan, effectiveLimitKrw, formatKrw, monthKey, planCapKrw, remainingKrw, usageLevel, usageRatio } from './usage'

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
