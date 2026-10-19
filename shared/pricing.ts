import type { ModelsConfig } from './config'
import type { JobType, JobUsage } from './jobs'
import { JOB_KIND } from './jobs'

/** 글 작업 입력 길이로 토큰을 높게 잡는다 (한국어 1글자 ≈ 1토큰으로 보수적) */
const OUTPUT_TOKENS: Partial<Record<JobType, number>> = {
  'story.analyze': 800,
  'story.draft': 3000,
  'story.titles': 300,
  'storyboard.split': 4000,
  'publish.caption': 500,
}

/** AIU-10: 예상 비용(원, 올림). 모델이 없으면 0 */
export function estimateKrw(models: ModelsConfig, modelId: string | undefined, type: JobType, opts: { inputChars?: number, images?: number, drafts?: number } = {}): number {
  const model = models.models.find(m => m.id === modelId && m.enabled)
  if (!model) return 0
  if (JOB_KIND[type] === 'image') return Math.ceil((model.priceKrw.perImage ?? 0) * (opts.images ?? 1))
  const inTok = (opts.inputChars ?? 0) + 1500
  const outTok = (OUTPUT_TOKENS[type] ?? 1000) * (opts.drafts ?? 1)
  return Math.ceil((inTok / 1000) * (model.priceKrw.perKTokensIn ?? 0) + (outTok / 1000) * (model.priceKrw.perKTokensOut ?? 0))
}

/** AIU-13: 제공사 사용량으로 계산한 실제 비용(원, 올림). 모델이 없으면 0 */
export function actualKrw(models: ModelsConfig, modelId: string | undefined, usage: JobUsage): number {
  const model = models.models.find(m => m.id === modelId)
  if (!model) return 0
  const p = model.priceKrw
  return Math.ceil((usage.images ?? 0) * (p.perImage ?? 0) + ((usage.inTokens ?? 0) / 1000) * (p.perKTokensIn ?? 0) + ((usage.outTokens ?? 0) / 1000) * (p.perKTokensOut ?? 0))
}
