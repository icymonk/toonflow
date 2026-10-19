import { describe, expect, it } from 'vitest'
import { AiError, classify, isLastAttempt } from './errors'

describe('classify', () => {
  it('keeps AiError codes', () => {
    expect(classify(new AiError('policy_rejected', 'blocked'))).toEqual({ code: 'policy_rejected', message: 'blocked', retryable: false })
  })
  it('maps http status', () => {
    expect(classify({ status: 429, message: 'slow down' }).code).toBe('rate_limited')
    expect(classify({ status: 503 }).code).toBe('provider_error')
    expect(classify({ status: 400 }).code).toBe('internal')
  })
  it('treats timeouts as provider errors', () => {
    expect(classify({ name: 'AbortError' }).code).toBe('provider_error')
    expect(classify({ code: 'ETIMEDOUT' }).code).toBe('provider_error')
  })
  it('defaults to internal and truncates', () => {
    const r = classify(new Error('x'.repeat(900)))
    expect(r.code).toBe('internal')
    expect(r.message).toHaveLength(500)
  })
})

describe('isLastAttempt', () => {
  it('follows MAX_ATTEMPTS', () => {
    expect(isLastAttempt('internal', 1)).toBe(true)
    expect(isLastAttempt('invalid_output', 1)).toBe(false)
    expect(isLastAttempt('invalid_output', 2)).toBe(true)
    expect(isLastAttempt('provider_error', 2)).toBe(false)
    expect(isLastAttempt('provider_error', 3)).toBe(true)
  })
})
