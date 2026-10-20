import type { ModelEntry } from '../../../../shared/config'
import { describe, expect, it, vi } from 'vitest'
import { AiError } from '../errors'
import { aspectRatio, geminiImage, geminiText } from './gemini'

const model: ModelEntry = { id: 'gemini-x', kind: 'text', provider: 'gemini', label: 'x', enabled: true, priceKrw: {} }
const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }))
const key = () => 'k'

describe('geminiText', () => {
  it('joins non-thought text and counts thinking as output', async () => {
    const f = reply(200, {
      responseId: 'r1',
      candidates: [{ content: { parts: [{ text: 'hmm', thought: true }, { text: '안녕' }, { text: '하세요' }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 7 },
    })
    const out = await geminiText(model, key, f).generate({ system: 's', prompt: 'p' })
    expect(out).toEqual({ text: '안녕하세요', usage: { inTokens: 10, outTokens: 12 }, requestId: 'r1' })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/gemini-x:generateContent')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('k')
    expect(JSON.parse(init.body as string).systemInstruction.parts[0].text).toBe('s')
  })

  it('puts a label before each image and asks for high media resolution', async () => {
    const f = reply(200, { candidates: [{ content: { parts: [{ text: '{}' }] } }] })
    const png = Buffer.from([0x89, 0x50, 0x4E, 0x47])
    await geminiText(model, key, f).generate({ system: 's', prompt: 'p', format: 'check', images: [png, png], imageLabels: ['그림 1', '그림 2'] })
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.contents[0].parts.map((x: { text?: string }) => x.text ?? 'img')).toEqual(['그림 1', 'img', '그림 2', 'img', 'p'])
    expect(body.generationConfig.mediaResolution).toBe('MEDIA_RESOLUTION_HIGH')
  })
  it('maps errors', async () => {
    const run = (status: number, body: unknown = {}) => geminiText(model, key, reply(status, body)).generate({ system: '', prompt: 'p' }).catch((e: AiError) => e.code)
    expect(await run(429)).toBe('rate_limited')
    expect(await run(503)).toBe('provider_error')
    expect(await run(402, { error: { status: 'RESOURCE_EXHAUSTED' } })).toBe('internal')
    expect(await run(200, { promptFeedback: { blockReason: 'SAFETY' } })).toBe('policy_rejected')
    expect(await run(200, { candidates: [{ finishReason: 'PROHIBITED_CONTENT' }] })).toBe('policy_rejected')
    expect(await run(200, { candidates: [{ content: { parts: [] } }] })).toBe('invalid_output')
  })
})

describe('geminiImage', () => {
  it('calls once per image and decodes inline data', async () => {
    const png = Buffer.from('png')
    const f = reply(200, { responseId: 'r', candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] })
    f.mockImplementation(async () => new Response(JSON.stringify({ responseId: 'r', candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] })))
    const out = await geminiImage({ ...model, kind: 'image' }, key, f).generate({ prompt: 'cat', size: { w: 1080, h: 1350 }, n: 2 })
    expect(f).toHaveBeenCalledTimes(2)
    expect(out.billedImages).toBe(2)
    expect(out.images[0]!.equals(png)).toBe(true)
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.generationConfig.imageConfig.aspectRatio).toBe('4:5')
  })
})

describe('aspectRatio', () => {
  it('picks the nearest supported ratio', () => {
    expect(aspectRatio(1080, 1350)).toBe('4:5')
    expect(aspectRatio(1080, 1920)).toBe('9:16')
    expect(aspectRatio(1000, 1000)).toBe('1:1')
  })
})
