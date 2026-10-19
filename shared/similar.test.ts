import { describe, expect, it } from 'vitest'
import { reportPageInput } from './reports'
import { similarGroups, similarity } from './similar'

describe('similar submissions (INB-26)', () => {
  const a = '회사에서 부장님이 회식 자리에서 갑자기 노래를 부르셨는데 아무도 박수를 안 쳤다'
  it('scores near-duplicates high and unrelated text low', () => {
    expect(similarity(a, `${a}!!`)).toBeGreaterThan(0.9)
    expect(similarity(a, a.replace(/\s/g, ''))).toBe(1)
    expect(similarity(a, '주말에 고양이랑 공원에 갔는데 비가 와서 바로 돌아왔다 그래도 재밌었다')).toBeLessThan(0.2)
  })
  it('groups both ways and skips short bodies', () => {
    const g = similarGroups([{ id: '1', body: a }, { id: '2', body: `${a} ㅋㅋ` }, { id: '3', body: '짧은 글' }, { id: '4', body: '짧은 글' }])
    expect(g.get('1')).toEqual(['2'])
    expect(g.get('2')).toEqual(['1'])
    expect(g.has('3')).toBe(false)
  })
  it('report input (CMN-40)', () => {
    expect(reportPageInput.safeParse({ slug: 'abcd2345efgh', reason: 'spam', detail: '' }).success).toBe(true)
    expect(reportPageInput.safeParse({ slug: 'BAD', reason: 'spam', detail: '' }).success).toBe(false)
    expect(reportPageInput.safeParse({ slug: 'abcd2345efgh', reason: 'x', detail: '' }).success).toBe(false)
  })
})
