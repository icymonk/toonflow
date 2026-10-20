import type { Page, Panel } from './studio'
import { describe, expect, it } from 'vitest'
import { continueOutfits, createHistory, emptyPanel, firstUnmetBefore, layoutOptions, movedPanelIds, movePage, movePanelTo, orderCuts, remaining } from './studio'

const page = (id: string, panelIds: string[], deleted = false): Page => ({ id, layout: '1', panelIds, deletedAt: deleted ? { toMillis: () => 1 } : null })
const panel = (id: string, pageId: string, scene = ''): Panel => ({ id, ...emptyPanel(pageId), scene })

describe('orderCuts', () => {
  it('follows pageOrder then panelIds and skips deleted', () => {
    const cuts = orderCuts(['p2', 'p1', 'p3'], [page('p1', ['a', 'b']), page('p2', ['c']), page('p3', ['d'], true)], [panel('a', 'p1'), panel('b', 'p1'), panel('c', 'p2'), { ...panel('x', 'p1'), deletedAt: { toMillis: () => 1 } }])
    expect(cuts.map(c => [c.panel.id, c.pageIndex, c.indexInPage, c.number])).toEqual([['c', 0, 0, 1], ['a', 1, 0, 2], ['b', 1, 1, 3]])
  })
})

describe('remaining', () => {
  const cuts = orderCuts(['p1'], [page('p1', ['a', 'b'])], [panel('a', 'p1', 'scene'), panel('b', 'p1')])
  it('counts unmet conditions per step', () => {
    const s = { activeStoryVersionId: null, status: 'active' as const, cuts }
    expect(remaining('story', s)).toBe(1)
    expect(remaining('storyboard', s)).toBe(1)
    expect(remaining('illustrate', s)).toBe(2)
    expect(remaining('storyboard', { ...s, cuts: [] })).toBe(1)
    expect(firstUnmetBefore('illustrate', s)).toBe('story')
    expect(firstUnmetBefore('story', s)).toBeNull()
    expect(remaining('export', { ...s, status: 'published' })).toBe(0)
  })
})

describe('movedPanelIds', () => {
  const cuts = orderCuts(['p1', 'p2'], [page('p1', ['a', 'b']), page('p2', ['c'])], [panel('a', 'p1'), panel('b', 'p1'), panel('c', 'p2')])
  it('swaps within a page and crosses page boundaries', () => {
    expect(movedPanelIds(cuts, 'a', 1)).toEqual({ p1: ['b', 'a'] })
    expect(movedPanelIds(cuts, 'b', 1)).toEqual({ p1: ['a'], p2: ['b', 'c'] })
    expect(movedPanelIds(cuts, 'c', -1)).toEqual({ p2: [], p1: ['a', 'b', 'c'] })
    expect(movedPanelIds(cuts, 'a', -1)).toBeNull()
  })
})

describe('createHistory', () => {
  it('undoes and redoes in order', async () => {
    const h = createHistory()
    const log: string[] = []
    h.push({ label: '1', undo: () => log.push('u1'), redo: () => log.push('r1') })
    h.push({ label: '2', undo: () => log.push('u2'), redo: () => log.push('r2') })
    await h.undo()
    await h.undo()
    expect(h.canUndo).toBe(false)
    await h.redo()
    expect(log).toEqual(['u2', 'u1', 'r1'])
    h.push({ label: '3', undo: () => {}, redo: () => {} })
    expect(h.canRedo).toBe(false)
  })
})

describe('movePanelTo / movePage / layoutOptions', () => {
  const pg = (id: string, panelIds: string[]) => ({ id, layout: '1' as const, panelIds })
  it('moves within and across pages, refusing full pages', () => {
    const pages = [pg('a', ['1', '2', '3']), pg('b', ['4']), pg('c', ['5', '6', '7', '8'])]
    expect(movePanelTo(pages, '1', 'a', 2)).toEqual({ a: ['2', '3', '1'] })
    expect(movePanelTo(pages, '2', 'b', 0)).toEqual({ a: ['1', '3'], b: ['2', '4'] })
    expect(movePanelTo(pages, '1', 'c', 0)).toBeNull()
  })
  it('swaps page order and gives layout choices', () => {
    expect(movePage(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(movePage(['a', 'b'], 'b', 1)).toBeNull()
    expect(layoutOptions(2)).toEqual(['2v', '2h'])
    expect(layoutOptions(3)).toEqual(['3'])
  })
})

describe('continueOutfits', () => {
  it('keeps the first outfit while place and time stay the same', () => {
    expect(continueOutfits([
      { place: '카페 · 낮', outfit: '흰 셔츠' },
      { place: '카페·낮', outfit: '파란 니트' },
      { place: '카페 · 낮', outfit: '' },
      { place: '집 · 밤', outfit: '잠옷' },
      { place: '', outfit: '정장' },
      { place: '', outfit: '코트' },
    ])).toEqual(['흰 셔츠', '흰 셔츠', '흰 셔츠', '잠옷', '정장', '코트'])
  })
  it('uses the next outfit when the first cut of a scene has none', () => {
    expect(continueOutfits([{ place: '교실', outfit: '' }, { place: '교실', outfit: '교복' }])).toEqual(['', '교복'])
  })
})
