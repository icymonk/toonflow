import type { Cut, Dialogue, Panel } from './studio'
import { describe, expect, it } from 'vitest'
import { autoCheck, autoPlace, cutRects, syncBubbles, wrapText } from './render'
import { emptyPanel } from './studio'

const d = (id: string, text: string, type: Dialogue['type'] = 'speech'): Dialogue => ({ id, type, speaker: '', speakerId: null, text })
const rect = { x: 0, y: 0, w: 1032, h: 1302 }

describe('render', () => {
  it('lays out cuts inside the page', () => {
    const r = cutRects('4', 4, 1080, 1350)
    expect(r).toHaveLength(4)
    expect(r[3]!.x + r[3]!.w).toBeCloseTo(1056)
    expect(cutRects('2h', 2, 1080, 1350)[1]!.y).toBe(24)
    expect(cutRects('2v', 2, 1080, 1350)[1]!.x).toBe(24)
  })
  it('wraps text', () => {
    expect(wrapText('가나다 라마바사 아', 5)).toEqual(['가나다', '라마바사', '아'])
    expect(wrapText('가나다라마바사', 3)).toEqual(['가나다', '라마바', '사'])
    expect(wrapText('a\nb', 9)).toEqual(['a', 'b'])
  })
  it('places bubbles in reading order inside the panel', () => {
    const bs = autoPlace([d('1', '안녕'), d('2', '오늘 회의 몇 시였지?'), d('3', '쾅', 'sfx')], rect, 34)
    expect(bs.map(b => b.dialogueId)).toEqual(['1', '2', '3'])
    expect(bs[1]!.y).toBeGreaterThan(bs[0]!.y)
    expect(bs[0]!.x).toBeLessThan(bs[1]!.x)
    expect(bs[2]!.bold).toBe(true)
    for (const b of bs) expect(b.x + b.w).toBeLessThanOrEqual(1)
  })
  it('keeps moved bubbles and checks issues', () => {
    const panel = { ...emptyPanel('pg'), id: 'p', dialogues: [d('1', 'a'), d('2', 'b')], bubbles: [{ dialogueId: '1', x: 0.8, y: 0, w: 0.4, h: 0.1, shape: 'speech', tail: 'none', fontSize: 20, bold: false }] } as Panel & { bubbles: never[] }
    const synced = syncBubbles(panel, rect, 34)
    expect(synced[0]!.x).toBe(0.8)
    expect(synced).toHaveLength(2)
    const issues = autoCheck([{ panel, number: 1 } as unknown as Cut]).map(i => i.kind)
    expect(issues).toEqual(['noImage', 'outside', 'noBubble'])
  })
})

describe('export helpers', () => {
  it('names files and splits batches', async () => {
    const { exportName, splitBatches } = await import('./render')
    expect(exportName('회사 썰/1', 3, 1, 'jpg')).toBe('회사_썰_1_3화_01.jpg')
    expect(splitBatches([1, 2, 3], 20)).toEqual([[1, 2, 3]])
    expect(splitBatches(Array.from({ length: 25 }, (_, i) => i), 20).map(b => b.length)).toEqual([20, 5])
  })
})
