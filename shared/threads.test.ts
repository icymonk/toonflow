import { describe, expect, it } from 'vitest'
import { threadsLength, threadsText } from './threads'

describe('threadsLength', () => {
  it('이모지는 UTF-8 바이트 수로 센다', () => {
    expect(threadsLength('안녕')).toBe(2)
    expect(threadsLength('😀')).toBe(4)
  })
})
describe('threadsText', () => {
  it('짧으면 그대로, 길면 500자 안으로 자르고 …', () => {
    expect(threadsText('짧은 글')).toBe('짧은 글')
    const t = threadsText('가'.repeat(600))
    expect(threadsLength(t)).toBeLessThanOrEqual(500)
    expect(t.endsWith('…')).toBe(true)
  })
})
