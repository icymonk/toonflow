import { z } from 'zod'

// 작품·에피소드 (docs/features/episodes.md, glossary 3절, data-model series·episodes)
export const TONES = ['empathy', 'comedy', 'touching', 'cider', 'horror', 'info'] as const
export type Tone = (typeof TONES)[number]
export const STEPS = ['story', 'storyboard', 'illustrate', 'review', 'export'] as const
export type Step = (typeof STEPS)[number]
export const EPISODE_STATUSES = ['active', 'done', 'published'] as const
export type EpisodeStatus = (typeof EPISODE_STATUSES)[number]
/** 목록에서 한 칸으로 보여 주는 상태: 작업 중이면 단계, 아니면 완료·발행됨 */
export type EpisodeStage = Step | Exclude<EpisodeStatus, 'active'>
export const EPISODE_STAGES = [...STEPS, 'done', 'published'] as const satisfies readonly EpisodeStage[]

const pageCount = z.number().int().min(1).max(20)

export const seriesInput = z.object({
  name: z.string().trim().min(1).max(40),
  intro: z.string().trim().max(100),
  tone: z.enum(TONES),
  pageCount,
})
export type SeriesInput = z.infer<typeof seriesInput>

export const createEpisodeInput = z.object({
  workspaceId: z.string().min(1),
  seriesId: z.string().min(1),
  title: z.string().trim().max(80),
  submissionIds: z.array(z.string().min(1)).max(10),
  storyText: z.string().trim().max(20000),
  tone: z.enum(TONES),
  pageCount,
  narrator: z.enum(['first', 'third']),
}).refine(d => d.submissionIds.length > 0 || d.storyText.length > 0, { message: 'material' })
export type CreateEpisodeInput = z.infer<typeof createEpisodeInput>

export const trashInput = z.object({
  workspaceId: z.string().min(1),
  kind: z.enum(['episode', 'series']),
  id: z.string().min(1),
})
export type TrashInput = z.infer<typeof trashInput>

interface Ts { toMillis: () => number }

export interface Series extends SeriesInput {
  id: string
  styleId?: string | null
  mainCharacterIds?: string[]
  episodeCount: number
  createdAt?: Ts
  deletedAt?: Ts | null
  archivedAt?: Ts | null
}

export interface Episode {
  id: string
  seriesId: string
  title: string
  number: number
  step: Step
  status: EpisodeStatus
  settings: { tone: Tone, pageCount: number, narrator: 'first' | 'third', aspect: string, extraRequest?: string, styleId?: string | null, characterIds?: string[] }
  submissionIds: string[]
  activeStoryVersionId?: string | null
  storyVersionCount?: number
  analysis?: import('./story').Analysis & { jobId: string }
  staleFrom?: 'story' | null
  pageOrder?: string[]
  costKrw: number
  updatedAt?: Ts
  deletedAt?: Ts | null
  archivedAt?: Ts | null
}

export const stageOf = (e: Pick<Episode, 'step' | 'status'>): EpisodeStage => (e.status === 'active' ? e.step : e.status)

/** EPI-12: 목록의 상태 칸에서 고른 값을 저장할 필드로 */
export function stagePatch(stage: EpisodeStage): Partial<Pick<Episode, 'step' | 'status'>> {
  return (STEPS as readonly string[]).includes(stage) ? { status: 'active', step: stage as Step } : { status: stage as EpisodeStatus }
}

/** 제목을 비우면 "N화" */
export const episodeTitle = (title: string, number: number) => title.trim() || `${number}화`
