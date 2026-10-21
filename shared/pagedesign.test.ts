import { describe, expect, it } from 'vitest'
import type { PageDesign } from './pagedesign'
import { defaultDesign, layoutDesign, pageDesignInput, pickDesign } from './pagedesign'

const info = { series: '회사생활', number: 3, title: '월요일 아침' }
const d = (id: string, kind: 'cover' | 'outro', deleted = false): PageDesign => ({ id, kind, imagePath: null, seriesId: null, ...defaultDesign(kind), deletedAt: deleted ? {} : null })

describe('pagedesign', () => {
  it('defaults are valid', () => {
    expect(pageDesignInput.safeParse(defaultDesign('cover')).success).toBe(true)
    expect(pageDesignInput.safeParse(defaultDesign('outro')).success).toBe(true)
    expect(pageDesignInput.safeParse({ ...defaultDesign('cover'), bgColor: 'red' }).success).toBe(false)
  })
  it('cover lays out series, number, title centered', () => {
    const l = layoutDesign(defaultDesign('cover'), info, 1080, 1350)
    expect(l.lines.map(x => x.text)).toEqual(['회사생활', '3화', '월요일 아침'])
    const mid = (l.lines[0]!.y + l.lines[2]!.y) / 2
    expect(Math.abs(mid - 675)).toBeLessThan(60)
    expect(l.box).toBeNull()
    expect(layoutDesign(defaultDesign('cover'), { ...info, title: '3화' }, 1080, 1350).lines.map(x => x.text)).toEqual(['회사생활', '3화'])
  })
  it('wraps long text, keeps blank lines, aligns bottom, boxes', () => {
    const l = layoutDesign({ ...defaultDesign('outro'), text: '가'.repeat(60) + '\n\n끝', align: 'bottom', boxed: true }, info, 1080, 1350)
    expect(l.lines.length).toBeGreaterThan(3)
    expect(l.lines.at(-1)!.text).toBe('끝')
    expect(l.lines.at(-1)!.y).toBeLessThan(1350 * 0.9)
    expect(l.box).not.toBeNull()
  })
  it('episode value overrides series default; empty turns off', () => {
    const list = [d('c1', 'cover'), d('c2', 'cover'), d('o1', 'outro'), d('gone', 'cover', true)]
    expect(pickDesign(undefined, 'c1', list, 'cover')?.id).toBe('c1')
    expect(pickDesign('c2', 'c1', list, 'cover')?.id).toBe('c2')
    expect(pickDesign('', 'c1', list, 'cover')).toBeNull()
    expect(pickDesign(undefined, 'gone', list, 'cover')).toBeNull()
    expect(pickDesign('o1', null, list, 'cover')).toBeNull()
  })
})
