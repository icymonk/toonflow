import { describe, expect, it } from 'vitest'
import { suggestSchema } from '../../../../shared/story'
import { textPrompt } from './story'

describe('story.suggest', () => {
  it('asks for 3 options for the field', () => {
    const out = textPrompt('story.suggest', { material: '썰', tone: 'comedy', pageCount: 6, narrator: 'first', draft: '각색안', suggest: { field: 'logline', text: '' } })
    expect(out.format).toBe('suggest')
    expect(out.system).toContain('한 줄 요약')
    expect(out.prompt).toContain('(비어 있음)')
  })
  it('dedupes and keeps at most 3 options', () => {
    expect(suggestSchema.parse({ options: ['a', 'a', 'b', 'c', 'd'] }).options).toEqual(['a', 'b', 'c'])
  })
})

describe('story.draft direction (STO-11)', () => {
  it('adds the direction rule only when given', () => {
    const base = { material: '썰', tone: 'comedy', pageCount: 6, narrator: 'first' }
    expect(textPrompt('story.draft', { ...base, direction: 'twist' }).system).toContain('방향: 반전·웃음')
    expect(textPrompt('story.draft', base).system).not.toContain('방향:')
  })
})

describe('story.episodes (STO-16)', () => {
  const base = { material: '긴 썰', tone: 'comedy', pageCount: 6, narrator: 'first' }
  it('uses the requested part count', () => {
    const out = textPrompt('story.episodes', { ...base, partCount: 3 })
    expect(out.format).toBe('episodes')
    expect(out.system).toContain('정확히 3화')
  })
  it('ends non-final parts on a cliffhanger', () => {
    expect(textPrompt('story.draft', { ...base, part: { index: 1, total: 3 } }).system).toContain('다음 화가 궁금해지는 장면에서 끊어')
    expect(textPrompt('story.draft', { ...base, part: { index: 3, total: 3 } }).system).toContain('마지막 화')
  })
})
