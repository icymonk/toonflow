import type { Character } from './library'
import { describe, expect, it } from 'vitest'
import { characterPrompt, describeAppearance, emptyAppearance, imageCount, matchCharacters, stylePrompt, stylePrompts } from './library'

const ch = (id: string, name: string, aliases: string[] = [], deleted = false): Character => ({
  id, name, aliases, intro: '', appearance: emptyAppearance(), appearanceText: '', episodeId: null, refImages: [], coverPath: null, deletedAt: deleted ? { toMillis: () => 1 } : null,
})

describe('library', () => {
  it('describes appearance and matches names/aliases', () => {
    expect(describeAppearance({ ...emptyAppearance(), age: '20대', hair: '검은 단발' })).toBe('나이대 20대, 머리 검은 단발')
    const chars = [ch('a', '민지', ['나']), ch('b', '팀장'), ch('c', '수진', [], true)]
    expect(matchCharacters(['나', '팀 장', '수진', '모름', '민지'], chars)).toEqual(['a', 'b'])
  })
  it('builds prompts and counts images', () => {
    const s = { name: 'x', description: '', line: 'thin', coloring: 'flat', palette: 'custom', paletteColors: '#fff', background: 'simple', negative: '', rightsConfirmed: false } as const
    expect(stylePrompt(s)).toContain('palette: #fff')
    expect(stylePrompts(s)).toHaveLength(3)
    expect(characterPrompt({ name: '민지', aliases: [], intro: '', appearance: emptyAppearance(), appearanceText: '안경', episodeId: null }, null)).toContain('안경')
    expect(imageCount({ prompts: ['a', 'b', 'c'] })).toBe(3)
    expect(imageCount({ prompt: 'a', n: 2 })).toBe(2)
  })
})
