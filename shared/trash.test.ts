import { describe, expect, it } from 'vitest'
import { daysLeft, trashCutoff, TRASH_DAYS } from './trash'

describe('trash', () => {
  it('counts days left and cutoff', () => {
    const now = Date.UTC(2026, 9, 31)
    expect(daysLeft(now, now)).toBe(TRASH_DAYS)
    expect(daysLeft(now - 10 * 86_400_000 - 1, now)).toBe(20)
    expect(daysLeft(now - 40 * 86_400_000, now)).toBe(0)
    expect(trashCutoff(now)).toBe(now - 30 * 86_400_000)
  })
})
