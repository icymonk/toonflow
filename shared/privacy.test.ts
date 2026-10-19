import { describe, expect, it } from 'vitest'
import { applyMask, findPii } from './privacy'

describe('privacy', () => {
  const text = '김민수씨가 010-1234-5678로 연락했고 minsu@example.com, 서울시 강남구 역삼동 123에 산다. 한빛고등학교 나왔고 부장님이 김민수씨 칭찬했다'
  it('finds pii and skips titles', () => {
    const hits = findPii(text)
    expect(hits.map(h => h.kind)).toEqual(['name', 'phone', 'email', 'address', 'school', 'name'])
    expect(hits.some(h => h.text === '부장')).toBe(false)
  })
  it('masks with stable name letters', () => {
    expect(applyMask(text, findPii(text))).toBe('A씨가 (전화번호)로 연락했고 (이메일), (주소)에 산다. OO학교 나왔고 부장님이 A씨 칭찬했다')
  })
  it('returns nothing for plain text', () => {
    expect(findPii('엘리베이터에서 방귀를 뀌었다')).toEqual([])
  })
})
