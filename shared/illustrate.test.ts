import type { Cut, Panel } from './studio'
import { describe, expect, it } from 'vitest'
import { bulkTargets, candidatePath, panelPrompt, zoomCrop, cutSize, FULL_BLEED } from './illustrate'
import { emptyAppearance } from './library'
import { emptyPanel } from './studio'

const panel = (over: Partial<Panel> = {}): Panel => ({ id: 'p', ...emptyPanel('pg'), ...over })

describe('illustrate', () => {
  it('builds prompt without text and with characters', () => {
    const c = { id: 'c', name: '민지', aliases: ['나'], intro: '', appearance: emptyAppearance(), appearanceText: '검은 단발', episodeId: null, refImages: [], coverPath: null }
    const p = panelPrompt(panel({ scene: '사무실', shot: 'wide', characterNames: ['나', '팀장'] }), [c], null, { leaveRoom: true, extra: '밝게' })
    expect(p).toContain('wide establishing shot')
    expect(p).toContain('검은 단발')
    expect(p).toContain('Other characters: 팀장')
    expect(p).toContain('Do not draw any text')
    expect(p).toContain('speech bubbles')
  })
  it('maps candidate id to path and crops', () => {
    expect(candidatePath('w', 'job_ab_1')).toBe('workspaces/w/aiJobs/job_ab/1.png')
    expect(zoomCrop(2, 0.5, 0)).toEqual({ x: 0.25, y: 0, w: 0.5, h: 0.5 })
    expect(zoomCrop(1, 1, 1).w).toBe(1)
  })
  it('picks bulk targets', () => {
    const cut = (id: string, over: Partial<Panel>) => ({ panel: { ...panel(over), id } }) as Cut
    const cuts = [cut('a', {}), cut('b', { selectedCandidateId: 'x' }), cut('c', { selectedCandidateId: 'x', staleFrom: 'scene' }), cut('d', {})]
    expect(bulkTargets(cuts, 'empty', new Set(['d'])).map(c => c.panel.id)).toEqual(['a'])
    expect(bulkTargets(cuts, 'stale', new Set()).map(c => c.panel.id)).toEqual(['c'])
  })
})

describe('cutSize', () => {
  const cut = (pageId: string, layout: string, indexInPage: number) => ({ page: { id: pageId, layout }, panel: {}, pageIndex: 0, indexInPage, number: 1 }) as unknown as import('./studio').Cut
  it('matches the cut cell so images are generated in the cell aspect', () => {
    const two = [cut('p', '2v', 0), cut('p', '2v', 1)]
    const s = cutSize(two, two[0]!, '4:5')
    expect(s.w).toBe(1032)
    expect(s.w / s.h).toBeGreaterThan(1.5)
    const one = [cut('q', '1', 0)]
    expect(cutSize(one, one[0]!, '1:1')).toEqual({ w: 1032, h: 1032 })
  })
  it('asks for a borderless full-bleed image', () => {
    expect(FULL_BLEED).toMatch(/no white margins/)
  })
})
