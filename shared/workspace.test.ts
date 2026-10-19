import { describe, expect, it } from 'vitest'
import { DEFAULT_WORKSPACE_DEFAULTS, withDefaults, workspaceSettingsInput } from './workspace'

describe('workspace settings', () => {
  it('fills missing defaults', () => {
    expect(withDefaults(undefined)).toEqual(DEFAULT_WORKSPACE_DEFAULTS)
    expect(withDefaults({ pageCount: 8 }).pageCount).toBe(8)
  })

  it('validates name and ranges', () => {
    expect(workspaceSettingsInput.safeParse({ name: ' ', defaults: DEFAULT_WORKSPACE_DEFAULTS }).success).toBe(false)
    expect(workspaceSettingsInput.safeParse({ name: '스튜디오', defaults: { ...DEFAULT_WORKSPACE_DEFAULTS, candidateCount: 5 } }).success).toBe(false)
    expect(workspaceSettingsInput.safeParse({ name: '스튜디오', defaults: DEFAULT_WORKSPACE_DEFAULTS }).success).toBe(true)
  })
})
