import { describe, expect, it } from 'vitest'
import { createWorkspaceInput, daysLater, userWorkspaceIds } from './workspaces'

describe('워크스페이스 여러 개 (ACC-12~14)', () => {
  it('merges the legacy single workspace into the list without duplicates', () => {
    expect(userWorkspaceIds({ workspaceId: 'a' })).toEqual(['a'])
    expect(userWorkspaceIds({ workspaceId: 'a', workspaceIds: ['b', 'a'] })).toEqual(['b', 'a'])
    expect(userWorkspaceIds({ workspaceId: null, workspaceIds: null })).toEqual([])
  })
  it('validates names and computes grace periods', () => {
    expect(createWorkspaceInput.safeParse({ name: '  ' }).success).toBe(false)
    expect(createWorkspaceInput.parse({ name: ' 새 작업실 ' }).name).toBe('새 작업실')
    expect(daysLater(0, 7)).toBe(7 * 86_400_000)
  })
})
