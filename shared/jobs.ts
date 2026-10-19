import { z } from 'zod'

/** AI 작업 종류 (docs/dev/ai-jobs.md 2절). 2단계 종류는 그때 추가 */
export const JOB_TYPES = ['story.analyze', 'story.draft', 'story.titles', 'storyboard.split', 'panel.image', 'style.sample', 'publish.caption', 'story.rewrite'] as const
export type JobType = (typeof JOB_TYPES)[number]
export const JOB_KIND: Record<JobType, 'text' | 'image'> = {
  'story.analyze': 'text',
  'story.draft': 'text',
  'story.titles': 'text',
  'storyboard.split': 'text',
  'panel.image': 'image',
  'style.sample': 'image',
  'publish.caption': 'text',
  'story.rewrite': 'text',
}

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled'
export const ACTIVE_STATUSES: readonly JobStatus[] = ['queued', 'running']

/** AIU-05 실패 분류 (docs/dev/ai-jobs.md 3절) */
export type JobErrorCode = 'policy_rejected' | 'rate_limited' | 'provider_error' | 'invalid_output' | 'internal'
/** 오류 종류별 최대 실행 횟수. 1이면 재시도하지 않는다 */
export const MAX_ATTEMPTS: Record<JobErrorCode, number> = {
  policy_rejected: 1,
  rate_limited: 3,
  provider_error: 3,
  invalid_output: 2,
  internal: 1,
}
export interface JobError { code: JobErrorCode, message: string, retryable: boolean }

/** 제공사가 돌려준 사용량. 실제 비용 정산에 쓴다 */
export interface JobUsage { inTokens?: number, outTokens?: number, images?: number }

export const startAiJobInput = z.object({
  workspaceId: z.string().min(1),
  type: z.enum(JOB_TYPES),
  target: z.object({
    episodeId: z.string().optional(),
    panelId: z.string().optional(),
    styleId: z.string().optional(),
    characterId: z.string().optional(),
  }),
  params: z.record(z.string(), z.unknown()),
  /** 버튼 누를 때 앱이 만든 UUID. 같은 키면 작업 하나 (AIU-12) */
  idempotencyKey: z.string().min(8).max(64),
  model: z.string().optional(),
})
export type StartAiJobInput = z.infer<typeof startAiJobInput>

export const jobRefInput = z.object({ workspaceId: z.string().min(1), jobId: z.string().min(1) })
export type JobRefInput = z.infer<typeof jobRefInput>
