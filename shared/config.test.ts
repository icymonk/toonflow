import { describe, expect, it } from 'vitest'
import { DEFAULT_MODELS, modelsConfig, parseEmails } from './config'

describe('config', () => {
  it('parses an email list', () => {
    expect(parseEmails('A@b.com\n a@b.com, c@d.kr  bad')).toEqual(['a@b.com', 'c@d.kr'])
  })

  it('validates models', () => {
    expect(modelsConfig.safeParse(DEFAULT_MODELS).success).toBe(true)
    expect(modelsConfig.safeParse({ ...DEFAULT_MODELS, models: [{ id: 'x', kind: 'video' }] }).success).toBe(false)
  })
})
