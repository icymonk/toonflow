import { describe, expect, it } from 'vitest'
import { safeRedirect, stripTrailingSlash } from './paths'

describe('stripTrailingSlash', () => {
  it('removes trailing slashes but keeps root', () => {
    expect(stripTrailingSlash('/login/finish/')).toBe('/login/finish')
    expect(stripTrailingSlash('/login')).toBe('/login')
    expect(stripTrailingSlash('/')).toBe('/')
  })
})

describe('safeRedirect', () => {
  it('keeps in-app paths', () => {
    expect(safeRedirect('/studio?ep=1')).toBe('/studio?ep=1')
  })
  it('falls back to root for login pages, external or missing values', () => {
    expect(safeRedirect('/login/')).toBe('/')
    expect(safeRedirect('/login/finish/?redirect=/login/')).toBe('/')
    expect(safeRedirect('//evil.example')).toBe('/')
    expect(safeRedirect('https://evil.example')).toBe('/')
    expect(safeRedirect(undefined)).toBe('/')
  })
})
