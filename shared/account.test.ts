import { describe, expect, it } from 'vitest'
import { defaultWorkspaceName, isAllowedEmail } from './account'

describe('account', () => {
  it('names the workspace after the user', () => {
    expect(defaultWorkspaceName('찬중', 'a@b.c')).toBe('찬중의 스튜디오')
    expect(defaultWorkspaceName('', 'icy@b.c')).toBe('icy의 스튜디오')
  })

  it('matches allowed emails case-insensitively', () => {
    expect(isAllowedEmail('Icy@Gmail.com', ['icy@gmail.com'])).toBe(true)
    expect(isAllowedEmail('x@gmail.com', ['icy@gmail.com'])).toBe(false)
    expect(isAllowedEmail(null, ['icy@gmail.com'])).toBe(false)
  })
})
