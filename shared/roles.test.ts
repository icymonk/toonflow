import { describe, expect, it } from 'vitest'
import { atLeast, canEdit, canManage } from './roles'

describe('roles', () => {
  it('ranks owner > admin > editor > viewer', () => {
    expect(atLeast('owner', 'admin')).toBe(true)
    expect(atLeast('editor', 'admin')).toBe(false)
    expect(atLeast(null, 'viewer')).toBe(false)
  })

  it('editors edit and run AI, only admins manage', () => {
    expect(canEdit('editor')).toBe(true)
    expect(canEdit('viewer')).toBe(false)
    expect(canManage('editor')).toBe(false)
    expect(canManage('admin')).toBe(true)
  })
})
