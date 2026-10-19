import { describe, expect, it } from 'vitest'
import { formatBytes } from './assets'

describe('formatBytes', () => {
  it('picks a unit', () => {
    expect(formatBytes(2048)).toBe('2KB')
    expect(formatBytes(5 * 1024 ** 2)).toBe('5.0MB')
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.00GB')
  })
})
