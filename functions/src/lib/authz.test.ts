import { HttpsError } from 'firebase-functions/v2/https'
import { describe, expect, it } from 'vitest'
import { ERROR_KEYS } from '../../../shared/callables'
import { assertRole } from './authz'

function denied(fn: () => unknown) {
  try {
    fn()
  }
  catch (error) {
    expect(error).toBeInstanceOf(HttpsError)
    return (error as HttpsError).message
  }
  throw new Error('expected rejection')
}

describe('assertRole', () => {
  it('rejects non-members', () => {
    expect(denied(() => assertRole(null, 'viewer'))).toBe(ERROR_KEYS.notMember)
  })

  it('rejects roles below the minimum', () => {
    expect(denied(() => assertRole('viewer', 'editor'))).toBe(ERROR_KEYS.forbidden)
  })

  it('returns the role when allowed', () => {
    expect(assertRole('owner', 'admin')).toBe('owner')
  })
})
