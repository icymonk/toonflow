import { describe, expect, it } from 'vitest'
import { composeBody, creditLine, findBanned, imageType, INTAKE_RATE, intakeSubmitInput, intakeTokenInput, newSlug, parseBanned, rateCheck, SLUG_RE, submitterState } from './intake'

const valid = { slug: 'abcd2345efgh', body: 'x'.repeat(40), answers: [], nickname: '', email: '', consent: true, credit: false, notify: false, images: [], website: '' }

describe('intake (INB-02~06)', () => {
  it('submitter state and credit line (INB-12·27, PUB-12)', () => {
    expect(submitterState('new', undefined, 0)).toBe('received')
    expect(submitterState('used', undefined, 0)).toBe('used')
    expect(submitterState('used', undefined, 1)).toBe('published')
    expect(submitterState('used', { published: true }, 1)).toBe('withdrawRequested')
    expect(submitterState('withdrawn', { published: false }, 0)).toBe('withdrawn')
    expect(creditLine(['민지', undefined, ' 민지 ', '하루'])).toBe('썰 제보: 민지 님, 하루 님')
    expect(creditLine([undefined, ''])).toBe('')
    expect(intakeTokenInput.safeParse({ token: 'a'.repeat(32) }).success).toBe(true)
    expect(intakeTokenInput.safeParse({ token: 'A'.repeat(32) }).success).toBe(false)
  })
  it('slugs are url-safe and random', () => {
    const a = newSlug()
    expect(a).toMatch(SLUG_RE)
    expect(newSlug()).not.toBe(a)
  })

  it('validates input: consent required, email optional', () => {
    expect(intakeSubmitInput.safeParse(valid).success).toBe(true)
    expect(intakeSubmitInput.safeParse({ ...valid, consent: false }).success).toBe(false)
    expect(intakeSubmitInput.safeParse({ ...valid, email: 'a@b.co' }).success).toBe(true)
    expect(intakeSubmitInput.safeParse({ ...valid, email: 'nope' }).success).toBe(false)
    expect(intakeSubmitInput.safeParse({ ...valid, slug: '../x' }).success).toBe(false)
  })

  it('appends answered questions to the body', () => {
    expect(composeBody(' 본문 ', ['언제?', '어디서?'], ['어제', ''])).toBe('본문\n\n[언제?]\n어제')
  })

  it('finds banned words ignoring case and spaces', () => {
    const words = parseBanned('광고, 도 박\n광고\n')
    expect(words).toEqual(['광고', '도 박'])
    expect(findBanned('여기 도박 사이트', words)).toBe('도 박')
    expect(findBanned('평범한 썰', words)).toBeNull()
  })

  it('rate limit keeps a sliding window', () => {
    let times: number[] = []
    for (let i = 0; i < INTAKE_RATE.max; i++) {
      const r = rateCheck(times, 1000 + i)
      expect(r.ok).toBe(true)
      times = r.times
    }
    expect(rateCheck(times, 2000).ok).toBe(false)
    expect(rateCheck(times, 1000 + INTAKE_RATE.windowMs + 10).ok).toBe(true)
  })

  it('detects image type from magic bytes', () => {
    expect(imageType(new Uint8Array([0x89, 0x50, 0x4E, 0x47]))?.ext).toBe('png')
    expect(imageType(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]))?.ext).toBe('jpg')
    expect(imageType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))?.ext).toBe('webp')
    expect(imageType(new TextEncoder().encode('<svg'))).toBeNull()
  })
})
