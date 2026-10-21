import { describe, expect, it } from 'vitest'
import { isStalled, STALL_MS } from './jobs'

describe('isStalled', () => {
  it('only long-running jobs', () => {
    expect(isStalled('running', 0, STALL_MS + 1)).toBe(true)
    expect(isStalled('running', 0, STALL_MS)).toBe(false)
    expect(isStalled('queued', 0, STALL_MS * 2)).toBe(false)
    expect(isStalled('running', undefined, STALL_MS * 2)).toBe(false)
  })
})
