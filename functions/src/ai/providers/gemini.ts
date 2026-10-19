import type { ModelEntry } from '../../../../shared/config'
import type { ImageModel, TextModel } from '../types'
import { defineSecret } from 'firebase-functions/params'
import { AiError } from '../errors'

/** Google AI Studio 키. Functions Secret Manager에만 둔다 (docs/dev/security.md) */
export const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY')

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const TIMEOUT_MS = 240_000
const BLOCKED = ['SAFETY', 'PROHIBITED_CONTENT', 'IMAGE_SAFETY', 'IMAGE_PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION']

interface Part { text?: string, thought?: boolean, inlineData?: { mimeType: string, data: string } }
interface GenerateResponse {
  responseId?: string
  promptFeedback?: { blockReason?: string }
  candidates?: { finishReason?: string, content?: { parts?: Part[] } }[]
  usageMetadata?: { promptTokenCount?: number, candidatesTokenCount?: number, thoughtsTokenCount?: number }
  error?: { code?: number, status?: string, message?: string }
}

export type Fetch = typeof fetch

/** HTTP 상태 → 작업 오류 (docs/dev/ai-jobs.md 3절). 402(선불 잔액 없음)·401·403·400은 다시 시도해도 같아서 internal */
export function geminiError(status: number, body: GenerateResponse): AiError {
  const message = `gemini ${status} ${body.error?.status ?? ''}: ${body.error?.message ?? ''}`.trim()
  if (status === 429) return new AiError('rate_limited', message)
  if (status >= 500) return new AiError('provider_error', message)
  return new AiError('internal', message)
}

export async function generateContent(model: string, body: unknown, key: string, f: Fetch = fetch): Promise<GenerateResponse> {
  const res = await f(`${BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const json = await res.json().catch(() => ({})) as GenerateResponse
  if (!res.ok) throw geminiError(res.status, json)
  const blocked = json.promptFeedback?.blockReason ?? (BLOCKED.includes(json.candidates?.[0]?.finishReason ?? '') ? json.candidates?.[0]?.finishReason : undefined)
  if (blocked) throw new AiError('policy_rejected', `gemini blocked: ${blocked}`)
  return json
}

const parts = (r: GenerateResponse) => r.candidates?.[0]?.content?.parts ?? []

/** 비율은 Gemini가 받는 값 중 가장 가까운 것으로 */
const RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const
export function aspectRatio(w: number, h: number): string {
  const target = w / h
  return RATIOS.reduce((best, r) => {
    const [a, b] = r.split(':').map(Number) as [number, number]
    const [x, y] = best.split(':').map(Number) as [number, number]
    return Math.abs(a / b - target) < Math.abs(x / y - target) ? r : best
  }, RATIOS[0] as string)
}

export function geminiText(m: ModelEntry, key = () => GEMINI_API_KEY.value(), f?: Fetch): TextModel {
  return {
    async generate({ system, prompt, maxTokens }) {
      const r = await generateContent(m.id, {
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { ...(maxTokens ? { maxOutputTokens: maxTokens } : {}) },
      }, key(), f)
      const text = parts(r).filter(p => p.text && !p.thought).map(p => p.text).join('')
      if (!text) throw new AiError('invalid_output', 'gemini returned no text')
      const u = r.usageMetadata ?? {}
      // 생각(thinking) 토큰도 출력 단가로 청구된다
      return { text, usage: { inTokens: u.promptTokenCount ?? 0, outTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) }, requestId: r.responseId ?? '' }
    },
  }
}

export function geminiImage(m: ModelEntry, key = () => GEMINI_API_KEY.value(), f?: Fetch): ImageModel {
  return {
    async generate({ prompt, negative, refImages = [], size, n }) {
      const text = negative ? `${prompt}\n\nAvoid: ${negative}` : prompt
      const body = {
        contents: [{ role: 'user', parts: [...refImages.map(b => ({ inlineData: { mimeType: 'image/png', data: b.toString('base64') } })), { text }] }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspectRatio(size.w, size.h) } },
      }
      // 한 번 호출에 한 장이라 n번 나눠 부른다
      const results = await Promise.all(Array.from({ length: n }, () => generateContent(m.id, body, key(), f)))
      const images = results.flatMap(r => parts(r).filter(p => p.inlineData?.mimeType.startsWith('image/')).map(p => Buffer.from(p.inlineData!.data, 'base64')))
      if (images.length === 0) throw new AiError('invalid_output', 'gemini returned no image')
      return { images, requestId: results.map(r => r.responseId ?? '').join(','), billedImages: images.length }
    },
  }
}
