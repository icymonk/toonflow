import { describe, expect, it } from 'vitest'
import { exportPathOk, igPostingActive, needsRefresh } from './instagram'

const DAY = 86_400_000
describe('needsRefresh', () => {
  it('만료 20일 안쪽이고 발급 하루가 지났을 때만', () => {
    expect(needsRefresh(30 * DAY, 0, 11 * DAY)).toBe(true)
    expect(needsRefresh(30 * DAY, 0, 5 * DAY)).toBe(false)
    expect(needsRefresh(30 * DAY, 11 * DAY - 1000, 11 * DAY)).toBe(false)
    expect(needsRefresh(30 * DAY, 0, 31 * DAY)).toBe(false)
  })
})
describe('igPostingActive', () => {
  const at = (ms: number) => ({ toMillis: () => ms })
  it('게시 중이고 10분이 안 지났을 때만', () => {
    expect(igPostingActive({ status: 'posting', at: at(0) }, 60_000)).toBe(true)
    expect(igPostingActive({ status: 'posting', at: at(0) }, 11 * 60_000)).toBe(false)
    expect(igPostingActive({ status: 'failed', at: at(0) }, 1)).toBe(false)
    expect(igPostingActive(null, 1)).toBe(false)
  })
})
describe('exportPathOk', () => {
  it('그 워크스페이스·에피소드의 JPG만', () => {
    expect(exportPathOk('workspaces/w/exports/e/1/01.jpg', 'w', 'e')).toBe(true)
    expect(exportPathOk('workspaces/x/exports/e/1/01.jpg', 'w', 'e')).toBe(false)
    expect(exportPathOk('workspaces/w/exports/e/../01.jpg', 'w', 'e')).toBe(false)
    expect(exportPathOk('workspaces/w/exports/e/1/01.png', 'w', 'e')).toBe(false)
  })
})
