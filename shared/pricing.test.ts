import { describe, expect, it } from 'vitest'
import { estimateKrw } from './pricing'

const models = {
  models: [
    { id: 'img', kind: 'image' as const, provider: 'fake', label: 'img', priceKrw: { perImage: 55 }, enabled: true },
    { id: 'txt', kind: 'text' as const, provider: 'fake', label: 'txt', priceKrw: { perKTokensIn: 2, perKTokensOut: 10 }, enabled: true },
    { id: 'off', kind: 'image' as const, provider: 'fake', label: 'off', priceKrw: { perImage: 100 }, enabled: false },
  ],
  defaults: {},
  usdToKrw: 1400,
}

describe('estimateKrw', () => {
  it('prices images per image', () => {
    expect(estimateKrw(models, 'img', 'panel.image', { images: 2 })).toBe(110)
  })

  it('prices text by tokens and drafts', () => {
    // in (500+1500)/1000*2=4, out 3000*2/1000*10=60
    expect(estimateKrw(models, 'txt', 'story.draft', { inputChars: 500, drafts: 2 })).toBe(64)
  })

  it('is 0 for unknown or disabled models', () => {
    expect(estimateKrw(models, 'off', 'panel.image')).toBe(0)
    expect(estimateKrw(models, undefined, 'panel.image')).toBe(0)
  })
})
