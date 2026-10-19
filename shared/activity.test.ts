import { describe, expect, it } from 'vitest'
import { failRate, logAdminViewInput } from './activity'

describe('운영자 현황·열람 기록 (CMN-51·54)', () => {
  it('computes failure rate with one decimal', () => {
    expect(failRate(0, 0)).toBe(0)
    expect(failRate(3, 1)).toBe(33.3)
  })
  it('requires a reason to view a workspace', () => {
    expect(logAdminViewInput.safeParse({ workspaceId: 'w', reason: ' ' }).success).toBe(false)
    expect(logAdminViewInput.safeParse({ workspaceId: 'w', reason: '신고 확인' }).success).toBe(true)
  })
})
