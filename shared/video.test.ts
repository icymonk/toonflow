import type { Cut } from './studio'
import { describe, expect, it } from 'vitest'
import { bubblesAt, buildClips, COVER_MS, frameAt, motionAt, suggestMs, totalMs } from './video'

const cut = (id: string, page: string, texts: string[]): Cut => ({
  panel: { id, pageId: page, dialogues: texts.map((text, i) => ({ id: `${id}${i}`, type: 'speech', speaker: '', speakerId: null, text })) } as unknown as Cut['panel'],
  page: { id: page, layout: '1', panelIds: [] },
  pageIndex: 0,
  indexInPage: 0,
  number: 1,
})
const cuts = [cut('a', 'p1', []), cut('b', 'p1', ['안녕하세요']), cut('c', 'p2', ['x'.repeat(200)])]

describe('video', () => {
  it('suggests duration by characters and clamps', () => {
    expect(suggestMs(0)).toBe(1500)
    expect(suggestMs(10)).toBe(1900)
    expect(suggestMs(500)).toBe(10_000)
  })
  it('builds panel clips in order with overrides; first clip has no transition', () => {
    const c = buildClips(cuts, { unit: 'panel', clips: { a: { transition: 'fade', durationMs: 2000 }, b: { durationMs: 99 } } })
    expect(c.map(x => [x.id, x.start, x.durationMs, x.transition])).toEqual([['a', 0, 2000, 'cut'], ['b', 2000, 500, 'fade'], ['c', 2500, 10_000, 'fade']])
    expect(totalMs(c)).toBe(12_500)
  })
  it('groups by page in page unit', () => {
    const c = buildClips(cuts, { unit: 'page', clips: {} })
    expect(c.map(x => [x.id, x.cuts.length, x.bubbles])).toEqual([['p1', 2, 1], ['p2', 1, 1]])
  })
  it('finds frame and transition state', () => {
    const c = buildClips(cuts, { unit: 'panel', clips: { a: { durationMs: 1000 } } })
    expect(frameAt(c, 500)).toEqual({ index: 0, local: 500, prev: null })
    expect(frameAt(c, 1150)).toEqual({ index: 1, local: 150, prev: { index: 0, p: 0.5 } })
    expect(frameAt(c, 1e9)!.index).toBe(2)
  })
  it('reveals bubbles in sequence and moves', () => {
    expect(bubblesAt({ reveal: 'sequence', bubbles: 3, durationMs: 3000 }, 0)).toBe(1)
    expect(bubblesAt({ reveal: 'sequence', bubbles: 3, durationMs: 3000 }, 2100)).toBe(3)
    expect(bubblesAt({ reveal: 'together', bubbles: 3, durationMs: 3000 }, 0)).toBe(3)
    expect(motionAt('zoomIn', 'mid', 1).scale).toBeCloseTo(1.12)
    expect(motionAt('panX', 'weak', 0).dx).toBeCloseTo(0.03)
  })
  it('cover clip goes first and shifts the timeline (PUB-38)', () => {
    const plain = buildClips(cuts, { unit: 'panel', clips: {} })
    const withCover = buildClips(cuts, { unit: 'panel', clips: {}, coverId: plain[1]!.id })
    expect(withCover).toHaveLength(plain.length + 1)
    expect(withCover[0]!.id).toBe(`cover:${plain[1]!.id}`)
    expect(withCover[0]!.durationMs).toBe(COVER_MS)
    expect(withCover[0]!.transition).toBe('cut')
    expect(withCover[1]!.start).toBe(COVER_MS)
    expect(buildClips(cuts, { unit: 'panel', clips: {}, coverId: 'gone' })).toHaveLength(plain.length)
  })
})
