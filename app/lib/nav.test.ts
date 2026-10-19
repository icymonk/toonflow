import { describe, expect, it } from 'vitest'
import { isActive, NAV_MAIN } from './nav'

describe('nav', () => {
  const home = NAV_MAIN[0]!
  const studio = NAV_MAIN.find(i => i.to === '/studio')!

  it('matches Home only on /', () => {
    expect(isActive(home, '/')).toBe(true)
    expect(isActive(home, '/inbox')).toBe(false)
  })

  it('matches nested paths', () => {
    expect(isActive(studio, '/studio/abc/story')).toBe(true)
    expect(isActive(studio, '/studios')).toBe(false)
  })
})
