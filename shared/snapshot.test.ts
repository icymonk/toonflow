import type { Page, Panel } from './studio'
import { describe, expect, it } from 'vitest'
import { restorePlan, snapshotDiff, takeSnapshot } from './snapshot'
import { emptyPanel } from './studio'

const panel = (id: string, patch: Partial<Panel> = {}) => ({ id, ...emptyPanel('pg1'), ...patch, updatedAt: { toMillis: () => 1 } }) as Panel
const page = (id: string, panelIds: string[], deletedAt: Page['deletedAt'] = null): Page => ({ id, layout: '1', panelIds, deletedAt })
const ep = { title: '1화', pageOrder: ['pg1'], activeStoryVersionId: 'v1' }

describe('takeSnapshot', () => {
  it('keeps live pages/panels and drops server/meta fields', () => {
    const s = takeSnapshot(ep, [page('pg1', ['a']), page('pg2', [], { toMillis: () => 1 })], [panel('a', { scene: '카페' }), panel('b', { deletedAt: { toMillis: () => 1 } })])
    expect(s.pages.map(p => p.id)).toEqual(['pg1'])
    expect(s.panels.map(p => p.id)).toEqual(['a'])
    expect(s.panels[0]).not.toHaveProperty('updatedAt')
    expect(s.panels[0]).not.toHaveProperty('deletedAt')
    expect(s.panels[0]!.scene).toBe('카페')
  })
})

describe('restorePlan', () => {
  it('rewrites snapshot docs and removes ones added since', () => {
    const s = takeSnapshot(ep, [page('pg1', ['a'])], [panel('a')])
    const plan = restorePlan(s, [page('pg1', ['a', 'c']), page('pg2', ['d'])], [panel('a'), panel('c'), panel('d')])
    expect(plan.panels.map(p => p.id)).toEqual(['a'])
    expect(plan.panels[0]!.data).not.toHaveProperty('id')
    expect(plan.removePages).toEqual(['pg2'])
    expect(plan.removePanels).toEqual(['c', 'd'])
    expect(plan.episode).toEqual({ title: '1화', pageOrder: ['pg1'], activeStoryVersionId: 'v1' })
  })
})

describe('snapshotDiff', () => {
  it('counts added/removed and lists changed kinds', () => {
    const a = takeSnapshot(ep, [page('pg1', ['a', 'b'])], [panel('a', { scene: '카페' }), panel('b')])
    const b = takeSnapshot({ ...ep, title: '2화' }, [page('pg1', ['a', 'c'])], [
      panel('a', { scene: '카페 밤', selectedCandidateId: 'x', mood: '쓸쓸' }),
      panel('c'),
    ])
    const d = snapshotDiff(a, b)
    expect(d).toMatchObject({ title: true, added: 1, removed: 1 })
    expect(d.changed).toEqual([{ panelId: 'a', scene: '카페 밤', kinds: ['scene', 'image', 'other'] }])
  })
})
