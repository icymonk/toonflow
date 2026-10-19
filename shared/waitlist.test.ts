import { describe, expect, it } from 'vitest'
import { decideWaitlistInput, joinWaitlistInput } from './waitlist'

describe('대기 명단 (CMN-41·52)', () => {
  const ok = { email: ' Me@Example.com ', name: '민지', handle: '@minji', note: '', agree: true }
  it('normalizes email and requires consent', () => {
    expect(joinWaitlistInput.parse(ok).email).toBe('me@example.com')
    expect(joinWaitlistInput.safeParse({ ...ok, agree: false }).success).toBe(false)
    expect(joinWaitlistInput.safeParse({ ...ok, email: 'not-an-email' }).success).toBe(false)
    expect(joinWaitlistInput.safeParse({ ...ok, name: ' ' }).success).toBe(false)
  })
  it('accepts approve/reject only', () => {
    expect(decideWaitlistInput.safeParse({ id: 'a', action: 'approve' }).success).toBe(true)
    expect(decideWaitlistInput.safeParse({ id: 'a', action: 'delete' }).success).toBe(false)
  })
})
