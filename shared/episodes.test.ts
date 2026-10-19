import { describe, expect, it } from 'vitest'
import { createEpisodeInput, episodeTitle, stageOf, stagePatch } from './episodes'

const base = { workspaceId: 'w', seriesId: 's', title: '', submissionIds: [], storyText: '', tone: 'empathy', pageCount: 6, narrator: 'first' } as const

describe('episodes', () => {
  it('needs a submission or story text', () => {
    expect(createEpisodeInput.safeParse(base).success).toBe(false)
    expect(createEpisodeInput.safeParse({ ...base, storyText: '썰' }).success).toBe(true)
    expect(createEpisodeInput.safeParse({ ...base, submissionIds: ['a'] }).success).toBe(true)
    expect(createEpisodeInput.safeParse({ ...base, storyText: '썰', pageCount: 0 }).success).toBe(false)
  })
  it('maps stage to fields', () => {
    expect(stageOf({ step: 'illustrate', status: 'active' })).toBe('illustrate')
    expect(stageOf({ step: 'export', status: 'published' })).toBe('published')
    expect(stagePatch('review')).toEqual({ status: 'active', step: 'review' })
    expect(stagePatch('done')).toEqual({ status: 'done' })
  })
  it('defaults title to N화', () => {
    expect(episodeTitle(' ', 3)).toBe('3화')
    expect(episodeTitle('엘리베이터', 3)).toBe('엘리베이터')
  })
})
