import { describe, expect, it } from 'vitest'
import { ko } from '../locales/ko'
import { errorMessage } from './errors'

describe('errorMessage', () => {
  it('maps server error keys', () => {
    expect(errorMessage({ code: 'functions/permission-denied', message: 'error.notMember' })).toBe(ko.errors.notMember)
  })

  it('maps Firebase codes and ignores closed popups', () => {
    expect(errorMessage({ code: 'auth/network-request-failed', message: '' })).toBe(ko.errors.network)
    expect(errorMessage({ code: 'auth/popup-closed-by-user' })).toBeNull()
  })

  it('falls back to a generic message', () => {
    expect(errorMessage(new Error('boom'))).toBe(ko.errors.unknown)
  })
})
