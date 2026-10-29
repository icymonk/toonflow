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
  /** QCK-18: 바로 넣은 썰의 제보 제목·출처 메모 (AI가 만든 썰) */
  storyTitle: z.string().trim().max(80).optional(),
  storyNote: z.string().trim().max(200).optional(),
}).refine(d => d.submissionIds.length > 0 || d.storyText.length > 0, { message: 'material' })
export type CreateEpisodeInput = z.infer<typeof createEpisodeInput>

/** EPI-14: structure = 장·컷 배치·등장 캐릭터·설정만, full = 장면·대사·말풍선·고른 그림까지 */
export const duplicateEpisodeInput = z.object({
  workspaceId: z.string().min(1),
  episodeId: z.string().min(1),
  mode: z.enum(['structure', 'full']),
})
export type DuplicateEpisodeInput = z.infer<typeof duplicateEpisodeInput>

/** STO-16: 긴 썰을 여러 화로. 화마다 재료 원문 일부를 갖는다 */
export const EPISODE_PARTS_MAX = 6
export const splitEpisodesInput = z.object({
  workspaceId: z.string().min(1),
  episodeId: z.string().min(1),
  parts: z.array(z.object({ title: z.string().trim().max(80), text: z.string().trim().min(1).max(20000) })).min(2).max(EPISODE_PARTS_MAX),
})
export type SplitEpisodesInput = z.infer<typeof splitEpisodesInput>
export interface MaterialPart { index: number, total: number, text: string }

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
  reviewItems?: string[]
  hashtags?: string
  greeting?: string
  watermark?: string
  memo?: string
  coverText?: string
  outroText?: string
  /** PUB-15·16 작품 기본 표지·끝장 디자인 */
  coverDesignId?: string | null
  outroDesignId?: string | null
  episodeCount: number
  createdAt?: Ts
  deletedAt?: Ts | null
  archivedAt?: Ts | null
}

export interface Episode {
  /** STO-16 여러 화로 나눈 재료 원문 일부 */
  materialPart?: MaterialPart | null
  /** STO-16 AI가 제안한 화 나누기 (서버만 씀) */
  episodePlan?: { parts: { title: string, text: string, hook: string }[], jobId: string } | null
  id: string
  seriesId: string
  title: string
  number: number
  step: Step
  status: EpisodeStatus
  settings: { tone: Tone, pageCount: number, narrator: 'first' | 'third', aspect: string, extraRequest?: string, styleId?: string | null, characterIds?: string[], format?: 'jpg' | 'png', aiLabel?: boolean, creditPlace?: 'caption' | 'page', hiRes?: boolean, plannedAt?: string | null, coverDesignId?: string, outroDesignId?: string }
  submissionIds: string[]
  activeStoryVersionId?: string | null
  storyVersionCount?: number
  analysis?: import('./story').Analysis & { jobId: string }
  staleFrom?: 'story' | null
  pageOrder?: string[]
  review?: Record<string, import('./review').ReviewState>
  caption?: { text: string, hashtags: string[] } | null
  aiCheck?: import('./aicheck').AiCheck | null
  /** 직접 표시했거나 바로 게시한 첫 발행. Instagram으로 올렸으면 instagramMediaId가 있다 */
  published?: { at?: Ts, url: string, instagramMediaId?: string } | null
  /** PUB-24: 서버가 Instagram에 게시하는 중·실패 (끝나면 지운다) */
  instagramPost?: { status: 'posting' | 'failed', error?: string, at?: Ts } | null
  /** PUB-25: Threads 게시 중·실패, 게시한 링크 */
  threadsPost?: { status: 'posting' | 'failed', error?: string, at?: Ts } | null
  threadsPublished?: { at?: Ts, url: string } | null
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
