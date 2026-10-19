import { z } from 'zod'

/** config/limits (AIU-04·11·20, CMN-50) */
export const limitsConfig = z.object({
  monthlyLimitKrw: z.number().int().min(0),
  confirmOverKrw: z.number().int().min(0),
  maxConcurrentJobs: z.number().int().min(1).max(20),
})
export type LimitsConfig = z.infer<typeof limitsConfig>
export const DEFAULT_LIMITS: LimitsConfig = { monthlyLimitKrw: 50000, confirmOverKrw: 3000, maxConcurrentJobs: 4 }

/** config/models (AIU-30, CMN-50). 가격은 원 단위 */
export const modelEntry = z.object({
  id: z.string().min(1),
  kind: z.enum(['text', 'image']),
  provider: z.string().min(1),
  label: z.string().min(1),
  priceKrw: z.object({
    perImage: z.number().min(0).optional(),
    perKTokensIn: z.number().min(0).optional(),
    perKTokensOut: z.number().min(0).optional(),
  }),
  enabled: z.boolean(),
})
export type ModelEntry = z.infer<typeof modelEntry>
export const modelsConfig = z.object({
  models: z.array(modelEntry),
  defaults: z.object({ text: z.string().optional(), image: z.string().optional() }),
  usdToKrw: z.number().positive(),
})
export type ModelsConfig = z.infer<typeof modelsConfig>
/** S1·S2 비교 결과(docs/dev/phase-plan.md 검증 결과) 기준 기본값. 가격은 2026-10 공개가 × usdToKrw, 이미지는 실측 출력 토큰 기준으로 올림 */
export const DEFAULT_MODELS: ModelsConfig = {
  models: [
    { id: 'gemini-3.8-flash', kind: 'text', provider: 'gemini', label: 'Gemini 3.8 Flash (기본)', priceKrw: { perKTokensIn: 1.05, perKTokensOut: 5.25 }, enabled: true },
    { id: 'gemini-3.5-flash-lite', kind: 'text', provider: 'gemini', label: 'Gemini 3.5 Flash-Lite (빠름·저렴)', priceKrw: { perKTokensIn: 0.42, perKTokensOut: 3.5 }, enabled: true },
    { id: 'gemini-3.1-pro-preview', kind: 'text', provider: 'gemini', label: 'Gemini 3.1 Pro (미리보기)', priceKrw: { perKTokensIn: 2.8, perKTokensOut: 16.8 }, enabled: false },
    { id: 'gemini-3.1-flash-lite-image', kind: 'image', provider: 'gemini', label: 'Gemini 3.1 Flash-Lite Image (기본)', priceKrw: { perImage: 65 }, enabled: true },
    { id: 'gemini-3-pro-image', kind: 'image', provider: 'gemini', label: 'Gemini 3 Pro Image (고품질)', priceKrw: { perImage: 215 }, enabled: true },
    { id: 'gemini-3.1-flash-image', kind: 'image', provider: 'gemini', label: 'Gemini 3.1 Flash Image', priceKrw: { perImage: 65 }, enabled: false },
  ],
  defaults: { text: 'gemini-3.8-flash', image: 'gemini-3.1-flash-lite-image' },
  usdToKrw: 1400,
}

/** config/access (ACC-02): 한 줄에 이메일 하나 */
export function parseEmails(text: string): string[] {
  return [...new Set(text.split(/[\s,]+/).map(s => s.trim().toLowerCase()).filter(s => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)))]
}
