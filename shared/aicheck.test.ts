import { describe, expect, it } from 'vitest'
import { aiCheckParams, checkInputChars, IMAGE_CHARS, mapCheckItems, mergeCheckBatches } from './aicheck'
import { bubbleStyle } from './render'

describe('AI 점검 (ILL-43·REV-13)', () => {
  it('maps 1-based picture numbers to panel ids and drops bad ones', () => {
    expect(mapCheckItems(['p1', 'p2'], [{ index: 2, issue: ' 손가락이 여섯 개 ' }, { index: 0, issue: 'x' }, { index: 3, issue: 'y' }, { index: 1, issue: ' ' }]))
      .toEqual([{ panelId: 'p2', issue: '손가락이 여섯 개' }])
  })
  it('drops findings the model is not sure about', () => {
    expect(mapCheckItems(['p1', 'p2', 'p3'], [{ index: 1, issue: '발가락 6개', confidence: 'medium' }, { index: 2, issue: '손 뭉개짐', confidence: 'low' }, { index: 3, issue: '팔이 없음', confidence: 'high' }]))
      .toEqual([{ panelId: 'p3', issue: '팔이 없음' }])
  })
  it('offsets batch-local picture numbers', () => {
    expect(mergeCheckBatches([[{ index: 2, issue: 'a' }], [{ index: 1, issue: 'b' }, { index: 9, issue: 'x' }]], 4))
      .toEqual([{ index: 2, issue: 'a' }, { index: 5, issue: 'b' }])
  })
  it('limits panels per check and counts pictures in the estimate', () => {
    expect(aiCheckParams.safeParse({ mode: 'quality', panelIds: Array.from({ length: 13 }, (_, i) => `p${i}`) }).success).toBe(false)
    expect(aiCheckParams.safeParse({ mode: 'consistency', panelIds: ['p1'], characters: null }).success).toBe(true)
    expect(checkInputChars({ panelIds: ['a', 'b'] })).toBe(2 * IMAGE_CHARS)
  })
})

describe('말풍선 템플릿 (REV-07)', () => {
  it('keeps only style fields', () => {
    expect(bubbleStyle({ dialogueId: 'd1', x: 1, y: 2, w: 300, h: 200, shape: 'sfx', tail: 'none', fontSize: 48, bold: true } as never))
      .toEqual({ shape: 'sfx', tail: 'none', fontSize: 48, bold: true, w: 300, h: 200 })
  })
})
