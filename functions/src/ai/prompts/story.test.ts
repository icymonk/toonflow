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
