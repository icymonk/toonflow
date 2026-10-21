import { describe, expect, it } from 'vitest'
import { socialRatio } from './social'

describe('socialRatio', () => {
  it('준비 → 처리 → 게시 순서로 늘어난다', () => {
    expect(socialRatio(null)).toBe(0)
    expect(socialRatio({ step: 'prepare', done: 5, total: 10 })).toBeCloseTo(0.4)
    expect(socialRatio({ step: 'process', done: 10, total: 10 })).toBeCloseTo(0.95)
    expect(socialRatio({ step: 'publish', done: 1, total: 1 })).toBe(1)
  })
})
