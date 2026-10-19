import type { Submission } from './submissions'
import { describe, expect, it } from 'vitest'
import { filterSubmissions, parseTags, splitBulk, submissionInput, titleFrom } from './submissions'

const s = (o: Partial<Submission>): Submission => ({ id: 'x', title: 't', body: 'b', source: 'dm', sourceNote: '', tags: [], status: 'new', starred: false, note: '', episodeIds: [], createdBy: 'u', ...o })

describe('submissions', () => {
  it('titleFrom uses first line when empty', () => {
    expect(titleFrom('', '\n  첫 줄이에요\n둘째 줄')).toBe('첫 줄이에요')
    expect(titleFrom(' 제목 ', '본문')).toBe('제목')
    expect(titleFrom('', 'ㄱ'.repeat(100))).toHaveLength(80)
  })
  it('splitBulk splits on --- lines only', () => {
    expect(splitBulk('a\n\nb\n---\nc\n  ----  \n\n---\n')).toEqual(['a\n\nb', 'c'])
    expect(splitBulk('a---b')).toEqual(['a---b'])
  })
  it('parseTags dedupes and strips #', () => {
    expect(parseTags('#회사, 연애 회사')).toEqual(['회사', '연애'])
  })
  it('validates input', () => {
    expect(submissionInput.safeParse({ title: 'a', body: 'b', source: 'dm', sourceNote: '', tags: [] }).success).toBe(true)
    expect(submissionInput.safeParse({ title: 'a', body: 'b', source: 'link', sourceNote: '', tags: [] }).success).toBe(false)
  })
  it('filters', () => {
    const now = 100 * 86_400_000
    const list = [
      s({ id: '1', status: 'new', tags: ['회사'], body: '엘리베이터' }),
      s({ id: '2', status: 'accepted', source: 'self', starred: true, createdAt: { toMillis: () => 0 } }),
      s({ id: '3', deletedAt: 1 }),
    ]
    const base = { status: 'all', source: 'all', tag: '', q: '', starred: false, days: 0 } as const
    expect(filterSubmissions(list, base, now).map(x => x.id)).toEqual(['1', '2'])
    expect(filterSubmissions(list, { ...base, status: 'accepted' }, now).map(x => x.id)).toEqual(['2'])
    expect(filterSubmissions(list, { ...base, tag: '회사' }, now).map(x => x.id)).toEqual(['1'])
    expect(filterSubmissions(list, { ...base, q: '엘리' }, now).map(x => x.id)).toEqual(['1'])
    expect(filterSubmissions(list, { ...base, days: 7 }, now).map(x => x.id)).toEqual(['1'])
    expect(filterSubmissions(list, { ...base, starred: true, source: 'self' }, now).map(x => x.id)).toEqual(['2'])
  })
})
