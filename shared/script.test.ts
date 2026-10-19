import type { Cut } from './studio'
import { describe, expect, it } from 'vitest'
import { adjustFilter } from './render'
import { scriptText } from './script'

const cut = (pageIndex: number, number: number, scene: string, text: string) => ({
  pageIndex, number, panel: { scene, shot: number === 1 ? '클로즈업' : '', dialogues: text ? [{ id: 'd1', type: 'speech', speaker: '민지', speakerId: null, text }] : [] },
}) as unknown as Cut

describe('script export (SBD-32)', () => {
  it('lists pages, cuts, scenes and dialogue', () => {
    const s = scriptText('1화', [cut(0, 1, '사무실', '안녕'), cut(0, 2, '', ''), cut(1, 3, '복도', '')])
    expect(s).toContain('# 1장\n## 1컷 · 클로즈업\n장면: 사무실\n민지: 안녕')
    expect(s).toContain('## 2컷\n')
    expect(s).toContain('# 2장\n## 3컷\n장면: 복도')
    expect(s.startsWith('1화\n')).toBe(true)
  })
})

describe('adjust filter (ILL-24)', () => {
  it('none without adjust, css filter otherwise', () => {
    expect(adjustFilter(null)).toBe('none')
    expect(adjustFilter({ brightness: 110, contrast: 90, saturate: 100 })).toBe('brightness(110%) contrast(90%) saturate(100%)')
  })
})
