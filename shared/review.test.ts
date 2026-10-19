import { describe, expect, it } from 'vitest'
import { checklist, reviewLeft } from './review'

describe('review checklist', () => {
  it('auto items pass without issues, manual items wait', () => {
    const rows = checklist([], true)
    expect(rows.filter(r => r.state === 'pass').map(r => r.key)).toEqual(['images', 'dialogues', 'bubbles', 'privacy', 'aiLabel'])
    expect(reviewLeft(rows)).toBe(2)
    expect(reviewLeft(checklist([], true, { typo: 'pass', credit: 'pass' }))).toBe(0)
  })
  it('missing images cannot be overridden, privacy can', () => {
    const issues = [{ kind: 'noImage' as const, panelId: 'p', number: 1 }, { kind: 'pii' as const, panelId: 'p', number: 1, dialogueId: 'd' }]
    const rows = checklist(issues, false, { images: 'pass', privacy: 'pass' }, ['로고'])
    expect(Object.fromEntries(rows.map(r => [r.key, r.state]))).toMatchObject({ images: 'needs', privacy: 'pass', aiLabel: 'needs', 'custom:로고': 'unchecked' })
  })
})
