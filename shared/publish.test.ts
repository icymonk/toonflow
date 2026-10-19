import { describe, expect, it } from 'vitest'
import { composeCaption, splitTags } from './publish'
import { AI_CAPTION } from './render'

describe('publish caption', () => {
  it('normalizes and dedupes tags', () => {
    expect(splitTags('#인스타툰, 공감툰  ##일상')).toEqual(['#인스타툰', '#공감툰', '#일상'])
  })
  it('composes greeting, text, tags and AI notice', () => {
    expect(composeCaption({ greeting: '안녕하세요!', text: '오늘의 썰', hashtags: ['#인스타툰', '#회사'], fixedTags: '인스타툰 내툰', aiLabel: true }))
      .toBe(`안녕하세요!\n\n오늘의 썰\n\n#인스타툰 #회사 #내툰\n\n${AI_CAPTION}`)
    expect(composeCaption({ text: '본문', aiLabel: false })).toBe('본문')
  })
})
