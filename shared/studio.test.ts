import type { Page, Panel } from './studio'
import { describe, expect, it } from 'vitest'
import { createHistory, emptyPanel, firstUnmetBefore, movedPanelIds, orderCuts, remaining } from './studio'

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
