import { describe, expect, it } from 'vitest'
import { aiCheckParams, checkInputChars, IMAGE_CHARS, mapCheckItems } from './aicheck'
import { bubbleStyle } from './render'

describe('AI 점검 (ILL-43·REV-13)', () => {
  it('maps 1-based picture numbers to panel ids and drops bad ones', () => {
    expect(mapCheckItems(['p1', 'p2'], [{ index: 2, issue: ' 손가락이 여섯 개 ' }, { index: 0, issue: 'x' }, { index: 3, issue: 'y' }, { index: 1, issue: ' ' }]))
      .toEqual([{ panelId: 'p2', issue: '손가락이 여섯 개' }])
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
