import { describe, expect, it } from 'vitest'
import { clipMs, pageCountOf, quickKey, quickStage } from './quick'

describe('quick', () => {
  it('pageCountOf', () => {
    expect(pageCountOf({ format: 'one', pages: 6 }, 5000)).toBe(1)
    expect(pageCountOf({ format: 'multi', pages: 8 }, 10)).toBe(8)
    expect(pageCountOf({ format: 'auto', pages: 6 }, 100)).toBe(1)
    expect(pageCountOf({ format: 'auto', pages: 6 }, 800)).toBe(4)
    expect(pageCountOf({ format: 'auto', pages: 6 }, 3000)).toBe(6)
  })
  it('clipMs', () => {
    expect(clipMs({ video: false, cutSec: 3, totalSec: null }, 6)).toBeNull()
    expect(clipMs({ video: true, cutSec: 1.5, totalSec: null }, 6)).toBe(1500)
    expect(clipMs({ video: true, cutSec: null, totalSec: 30 }, 8)).toBe(3800)
    expect(clipMs({ video: true, cutSec: null, totalSec: 60 }, 2)).toBe(10000)
  })
  it('quickStage', () => {
    const base = { hasStory: true, hasBoard: true, cuts: 6, drawn: 6, done: false }
    expect(quickStage({ ...base, hasStory: false })).toBe('story')
    expect(quickStage({ ...base, hasBoard: false })).toBe('storyboard')
    expect(quickStage({ ...base, drawn: 3 })).toBe('images')
    expect(quickStage(base)).toBe('bubbles')
    expect(quickStage({ ...base, done: true })).toBe('done')
  })
  it('quickKey stays within 64 chars', () => {
    expect(quickKey('a'.repeat(20), `img-${'b'.repeat(40)}`).length).toBeLessThanOrEqual(64)
  })
})
