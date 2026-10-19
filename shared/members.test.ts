import { describe, expect, it } from 'vitest'
import { assignable, canChangeMember, createInviteInput, inviteTokenInput } from './members'

describe('멤버 권한 (ACC-20·21)', () => {
  it('owners assign any non-owner role; admins only editor/viewer', () => {
    expect(assignable('owner')).toEqual(['admin', 'editor', 'viewer'])
    expect(assignable('admin')).toEqual(['editor', 'viewer'])
    expect(assignable('editor')).toEqual([])
  })
  it('nobody changes the owner; admins cannot change other admins', () => {
    expect(canChangeMember('owner', 'admin')).toBe(true)
    expect(canChangeMember('admin', 'admin')).toBe(false)
    expect(canChangeMember('admin', 'editor')).toBe(true)
    expect(canChangeMember('owner', 'owner')).toBe(false)
    expect(canChangeMember('editor', 'viewer')).toBe(false)
  })
  it('validates invite input', () => {
    expect(createInviteInput.safeParse({ workspaceId: 'w', role: 'owner', days: 7 }).success).toBe(false)
    expect(createInviteInput.safeParse({ workspaceId: 'w', role: 'editor', days: 3 }).success).toBe(false)
    expect(createInviteInput.safeParse({ workspaceId: 'w', role: 'viewer', days: 30 }).success).toBe(true)
    expect(inviteTokenInput.safeParse({ token: 'short' }).success).toBe(false)
    expect(inviteTokenInput.safeParse({ token: 'aZ09_-aZ09_-aZ09_-aZ09_-aZ09_-ab' }).success).toBe(true)
  })
})
