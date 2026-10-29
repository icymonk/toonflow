import type { Tone } from './episodes'
import type { DraftDirection } from './story'

// Quick 빠른 제작 (docs/features/quick.md)
export const QUICK_FORMATS = ['one', 'multi', 'auto'] as const
export type QuickFormat = (typeof QUICK_FORMATS)[number]
export const QUICK_PAGES = [4, 6, 8] as const
export const QUICK_SHAPES = ['human', 'animal', 'object', 'stick', 'registered'] as const
export type QuickShape = (typeof QUICK_SHAPES)[number]
export const QUICK_DIRECTIONS = ['twist', 'emotion', 'faithful', 'verbatim'] as const
export type QuickDirection = (typeof QUICK_DIRECTIONS)[number]
export const LINE_LENGTHS = ['short', 'normal', 'long'] as const
export type LineLength = (typeof LINE_LENGTHS)[number]
/** QCK-12 컷당 시간(초)·전체 길이(초) */
export const QUICK_CUT_SECS = [1.5, 3, 5] as const
export const QUICK_TOTAL_SECS = [15, 30, 60] as const

export interface QuickAnswers {
  format: QuickFormat
  pages: number
  video: boolean
  /** 컷당 시간(초). 전체 길이를 고르면 null */
  cutSec: number | null
  totalSec: number | null
  styleId: string | null
  shape: QuickShape
  direction: QuickDirection
  lineLength: LineLength
}

export const defaultAnswers = (): QuickAnswers => ({ format: 'one', pages: 6, video: false, cutSec: 3, totalSec: null, styleId: null, shape: 'human', direction: 'twist', lineLength: 'short' })

/** QCK-16: 대사 한 개 글자 수와 컷당 대사 수 */
export const LINE_RULE: Record<LineLength, { chars: number, perPanel: number }> = {
  short: { chars: 15, perPanel: 1 },
  normal: { chars: 25, perPanel: 2 },
  long: { chars: 40, perPanel: 3 },
}
export const defaultLineLength = (format: QuickFormat): LineLength => (format === 'one' ? 'short' : 'normal')

/** QCK-11 "AI 추천": 썰 길이로 장 수를 정한다 */
export function pageCountOf(a: Pick<QuickAnswers, 'format' | 'pages'>, materialChars: number): number {
  if (a.format === 'one') return 1
  if (a.format === 'multi') return a.pages
  return materialChars < 400 ? 1 : materialChars < 1500 ? 4 : 6
}

export const DIRECTION_TONE: Record<QuickDirection, Tone> = { twist: 'comedy', emotion: 'touching', faithful: 'empathy', verbatim: 'empathy' }
export const draftDirection = (d: QuickDirection): DraftDirection | null => (d === 'verbatim' ? null : d)

/** QCK-14: 각색·콘티에 붙이는 요청과 그림에 붙이는 프롬프트 */
export const SHAPE_REQUEST: Record<QuickShape, string> = {
  human: '',
  animal: '등장인물은 모두 의인화된 동물(고양이·강아지 등)이야. 인물마다 어떤 동물인지 정해서 끝까지 같게 써.',
  object: '등장인물은 모두 의인화된 사물·음식(감자·콩 등)이야. 인물마다 무엇인지 정해서 끝까지 같게 써.',
  stick: '등장인물은 모두 단순한 선으로 그린 졸라맨 같은 캐릭터야.',
  registered: '',
}
export const SHAPE_PROMPT: Record<QuickShape, string> = {
  human: '',
  animal: 'All characters are cute anthropomorphic animals (cats, dogs, etc.) with expressive faces; keep each character the same animal and colors in every panel.',
  object: 'All characters are anthropomorphized objects or food (e.g. potato, bean) with simple faces, tiny arms and legs; keep each character identical in every panel.',
  stick: 'All characters are minimal stick figures: round head, single-line body and limbs, simple dot eyes; keep them identical in every panel.',
  registered: '',
}

/** QCK-12: 컷당 보여 줄 시간(ms). 영상을 안 만들면 null */
export function clipMs(a: Pick<QuickAnswers, 'video' | 'cutSec' | 'totalSec'>, cuts: number): number | null {
  if (!a.video) return null
  const ms = a.totalSec ? (a.totalSec * 1000) / Math.max(1, cuts) : (a.cutSec ?? 3) * 1000
  return Math.min(10_000, Math.max(500, Math.round(ms / 100) * 100))
}

/** QCK-21: 에피소드 상태로 지금 단계를 정한다 (다시 열어도 이어서) */
export const QUICK_STAGES = ['story', 'storyboard', 'images', 'bubbles', 'done'] as const
export type QuickStage = (typeof QUICK_STAGES)[number]
export function quickStage(s: { hasStory: boolean, hasBoard: boolean, cuts: number, drawn: number, done: boolean }): QuickStage {
  if (s.done) return 'done'
  if (!s.hasStory) return 'story'
  if (!s.hasBoard || !s.cuts) return 'storyboard'
  if (s.drawn < s.cuts) return 'images'
  return 'bubbles'
}

/** 작업 중복 방지 키 (startAiJob idempotencyKey, 8~64자) */
export const quickKey = (episodeId: string, step: string) => `quick-${episodeId}-${step}`.slice(0, 64)
