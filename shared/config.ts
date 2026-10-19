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
export const modelsConfig = z.object({
  models: z.array(modelEntry),
  defaults: z.object({ text: z.string().optional(), image: z.string().optional() }),
  usdToKrw: z.number().positive(),
})
export type ModelsConfig = z.infer<typeof modelsConfig>
export const DEFAULT_MODELS: ModelsConfig = { models: [], defaults: {}, usdToKrw: 1400 }

/** config/access (ACC-02): 한 줄에 이메일 하나 */
export function parseEmails(text: string): string[] {
  return [...new Set(text.split(/[\s,]+/).map(s => s.trim().toLowerCase()).filter(s => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)))]
}
