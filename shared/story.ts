import type { Tone } from './episodes'
import { z } from 'zod'
import { TONES } from './episodes'

type Ts = { toMillis: () => number }

export const DIALOGUE_TYPES = ['speech', 'thought', 'whisper', 'shout', 'narration', 'sfx'] as const
export type StoryDialogueType = (typeof DIALOGUE_TYPES)[number]

const line = z.object({
  speaker: z.string().catch(''),
  type: z.enum(DIALOGUE_TYPES).catch('speech'),
  text: z.string(),
})
export type StoryLine = z.infer<typeof line>

// STO-10 썰 분석
export const analysisSchema = z.object({
  summary: z.array(z.string()).max(5),
  characters: z.array(z.object({ name: z.string(), role: z.string().catch('') })).max(10).catch([]),
  points: z.array(z.string()).max(8).catch([]),
  sensitive: z.array(z.object({ text: z.string(), reason: z.string() })).max(10).catch([]),
})
export type Analysis = z.infer<typeof analysisSchema>

// STO-11 각색안 (story.md 3절 형식)
export const draftSchema = z.object({
  titles: z.array(z.string()).max(5).catch([]),
  logline: z.string().catch(''),
  scenes: z.array(z.object({ heading: z.string(), beats: z.string(), dialogues: z.array(line).catch([]) })).min(1).max(20),
  punchline: z.string().catch(''),
})
export type Draft = z.infer<typeof draftSchema>

// STO-14 제목 후보
export const titlesSchema = z.object({ titles: z.array(z.string()).min(1).max(5) })
// INB-23 제보 AI 요약: 세 줄 요약·장르 추천·웹툰 거리 점수(0~100)
export const summarySchema = z.object({
  summary: z.array(z.string()).min(1).max(3),
  genre: z.enum(TONES).catch('empathy'),
  score: z.number().int().min(0).max(100).catch(50),
  reason: z.string().max(300).catch(''),
})
export type SubmissionSummary = z.infer<typeof summarySchema>

export const captionSchema = z.object({ caption: z.string().min(1).max(2000), hashtags: z.array(z.string()).max(30).catch([]) })

// SBD-01 자동 콘티
export const splitSchema = z.object({
  pages: z.array(z.object({
    panels: z.array(z.object({
      scene: z.string(),
      place: z.string().catch(''),
      characters: z.array(z.string()).max(8).catch([]),
      shot: z.enum(['closeup', 'bust', 'full', 'wide', 'pov']).or(z.literal('')).catch(''),
      expression: z.string().catch(''),
      action: z.string().catch(''),
      outfit: z.string().catch(''),
      mood: z.string().catch(''),
      dialogues: z.array(line).max(8).catch([]),
    })).min(1).max(4),
  })).min(1).max(20),
})
export type Split = z.infer<typeof splitSchema>

/** story.* 작업의 params. 앱이 재료·설정을 담아 보낸다 (예상 비용도 이 길이로 계산) */
export const REWRITE_MODES = ['rewrite', 'shorter', 'funnier', 'tone', 'refine'] as const
export type RewriteMode = (typeof REWRITE_MODES)[number]
export const rewriteSchema = z.object({ text: z.string().min(1).max(3000) })
/** 추천 입력: 각색안 칸 하나에 넣을 AI 후보 */
export const SUGGEST_FIELDS = ['logline', 'heading', 'beats', 'punchline'] as const
export type SuggestField = (typeof SUGGEST_FIELDS)[number]
export const suggestSchema = z.object({ options: z.array(z.string().trim().min(1).max(1000)).min(1).max(5).transform(o => [...new Set(o)].slice(0, 3)) })

/** STO-16 화 나누기 결과 */
export const episodesSchema = z.object({
  parts: z.array(z.object({ title: z.string().trim().max(80).catch(''), text: z.string().trim().min(1).max(20000), hook: z.string().trim().max(300).catch('') })).min(2).max(6),
})

/** STO-11: 여러 안을 받으면 안마다 방향을 다르게 */
export const DRAFT_DIRECTIONS = ['faithful', 'twist', 'emotion'] as const
export type DraftDirection = (typeof DRAFT_DIRECTIONS)[number]
export const DIRECTION_KO: Record<DraftDirection, string> = { faithful: '원작 충실', twist: '반전·웃음', emotion: '감정선' }

export const storyParams = z.object({
  material: z.string().trim().min(1).max(20000),
  tone: z.enum(TONES),
  pageCount: z.number().int().min(1).max(20),
  narrator: z.enum(['first', 'third']),
  extraRequest: z.string().max(500).catch(''),
  basedOn: z.string().optional(),
  direction: z.enum(DRAFT_DIRECTIONS).optional(),
  /** STO-16: 몇 화로 나눌지(없으면 AI가 정함), 이 화가 몇 화 중 몇 번째인지 */
  partCount: z.number().int().min(2).max(6).optional(),
  part: z.object({ index: z.number().int().min(1), total: z.number().int().min(2) }).optional(),
  versionId: z.string().optional(),
  draft: z.string().max(20000).optional(),
  /** STO-03: 작품 메모·캐릭터 성격·말투 */
  context: z.string().max(4000).optional(),
  /** STO-13: 부분 다시 쓰기 */
  rewrite: z.object({ mode: z.enum(REWRITE_MODES), text: z.string().min(1).max(3000), tone: z.string().max(40).catch('') }).optional(),
  suggest: z.object({ field: z.enum(SUGGEST_FIELDS), text: z.string().max(3000).catch(''), scene: z.string().max(3000).optional() }).optional(),
})
export type StoryParams = z.infer<typeof storyParams>

export interface StoryScene { id: string, heading: string, beats: string, dialogues: StoryLine[] }
export interface StoryVersion {
  id: string
  label: string
  source: 'ai' | 'manual'
  logline: string
  scenes: StoryScene[]
  punchline: string
  titleCandidates: string[]
  settings: { tone: Tone, pageCount: number, narrator: 'first' | 'third', extraRequest: string, direction?: DraftDirection | null }
  jobId: string | null
  basedOn: string | null
  editedAt?: Ts | null
  createdAt?: Ts
}

/** 모델 응답(코드 블록 감싸기 허용) → 스키마 검증. 실패하면 null */
export function parseJson<T>(schema: z.ZodType<T>, text: string): T | null {
  const body = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  try {
    const out = schema.safeParse(JSON.parse(body))
    return out.success ? out.data : null
  }
  catch {
    return null
  }
}

// STO-20 직접 편집: 대사 목록 ↔ 한 줄에 하나 "[생각] 민지: 대사"
export const DIALOGUE_LABEL: Record<StoryDialogueType, string> = { speech: '', thought: '생각', whisper: '속삭임', shout: '외침', narration: '내레이션', sfx: '효과음' }
const LABEL_TYPE = Object.fromEntries(Object.entries(DIALOGUE_LABEL).filter(([, v]) => v).map(([k, v]) => [v, k])) as Record<string, StoryDialogueType>

export const dialoguesToText = (lines: StoryLine[]) =>
  lines.map(l => `${DIALOGUE_LABEL[l.type] ? `[${DIALOGUE_LABEL[l.type]}] ` : ''}${l.speaker ? `${l.speaker}: ` : ''}${l.text}`).join('\n')

export function textToDialogues(text: string): StoryLine[] {
  return text.split('\n').map(s => s.trim()).filter(Boolean).map((raw) => {
    let rest = raw
    let type: StoryDialogueType = 'speech'
    const tag = rest.match(/^\[([^\]]+)\]\s*/)
    if (tag && LABEL_TYPE[tag[1]!]) {
      type = LABEL_TYPE[tag[1]!]!
      rest = rest.slice(tag[0].length)
    }
    const sp = rest.match(/^([^:：]{1,20})[:：]\s*/)
    return sp ? { type, speaker: sp[1]!.trim(), text: rest.slice(sp[0].length) } : { type: type === 'speech' ? 'narration' : type, speaker: '', text: rest }
  })
}

/** 제목 후보·Storyboard 입력용 평문 */
export const versionToText = (v: Pick<StoryVersion, 'logline' | 'scenes' | 'punchline'>) =>
  [v.logline, ...v.scenes.map((s, i) => `#${i + 1} ${s.heading}\n${s.beats}\n${dialoguesToText(s.dialogues)}`), v.punchline].filter(Boolean).join('\n\n')

/** STO-03: 각색 때 함께 넘기는 작품 참고 글 */
export function storyContext(memo: string | undefined, chars: { name: string, personality?: string, speech?: string[], appearance?: { outfit?: string } }[], prev = ''): string {
  const lines: string[] = []
  if (memo?.trim()) lines.push(`작품 메모: ${memo.trim()}`)
  if (prev) lines.push(prev)
  for (const c of chars) {
    const speech = (c.speech ?? []).map(x => x.trim()).filter(Boolean)
    const parts = [c.personality?.trim() && `성격 ${c.personality.trim()}`, speech.length && `말투 예: ${speech.map(x => `"${x}"`).join(' ')}`, c.appearance?.outfit?.trim() && `기본 의상 ${c.appearance.outfit.trim()}`].filter(Boolean)
    if (parts.length) lines.push(`${c.name}: ${parts.join(' / ')}`)
  }
  return lines.join('\n').slice(0, 4000)
}

export const PREV_SUMMARY_MAX = 1200

/** STO-03: 같은 작품 직전 화의 확정 각색안 줄거리 (이어지는 연재용) */
export function prevEpisodeSummary(ep: { number: number, title: string }, v: Pick<StoryVersion, 'logline' | 'scenes' | 'punchline'>): string {
  const scenes = v.scenes.map((s, i) => `${i + 1}. ${[s.heading.trim(), s.beats.trim()].filter(Boolean).join(' — ')}`).filter(x => x.length > 3)
  const body = [v.logline.trim() && `요약 ${v.logline.trim()}`, ...scenes, v.punchline.trim() && `마무리 ${v.punchline.trim()}`].filter(Boolean)
  if (!body.length) return ''
  return [`지난 화(${ep.number}화${ep.title.trim() ? ` "${ep.title.trim()}"` : ''}) 줄거리:`, ...body].join('\n').slice(0, PREV_SUMMARY_MAX)
}

/** 같은 작품에서 이 화보다 번호가 작은 화 중 가장 가까운, 각색안이 확정된 화 */
export function previousEpisode<T extends { id: string, number: number, deletedAt?: unknown, activeStoryVersionId?: string | null }>(eps: T[], cur: { id: string, number: number }): T | null {
  return eps.filter(e => e.id !== cur.id && !e.deletedAt && e.activeStoryVersionId && e.number < cur.number).sort((a, b) => b.number - a.number)[0] ?? null
}

/** STO-23: 두 각색안을 장면별로 나란히, 바뀐 부분 표시 */
export interface SceneSide { heading: string, beats: string, headingChanged: boolean, beatsChanged: boolean, lines: { text: string, changed: boolean }[] }
export function sceneDiff(a: Pick<StoryVersion, 'scenes'>, b: Pick<StoryVersion, 'scenes'>): { a: SceneSide | null, b: SceneSide | null }[] {
  const side = (s?: StoryScene, o?: StoryScene): SceneSide | null => {
    if (!s) return null
    const other = new Set(o ? dialoguesToText(o.dialogues).split('\n') : [])
    return {
      heading: s.heading,
      beats: s.beats,
      headingChanged: s.heading.trim() !== (o?.heading.trim() ?? ''),
      beatsChanged: s.beats.trim() !== (o?.beats.trim() ?? ''),
      lines: dialoguesToText(s.dialogues).split('\n').filter(Boolean).map(text => ({ text, changed: !other.has(text) })),
    }
  }
  return Array.from({ length: Math.max(a.scenes.length, b.scenes.length) }, (_, i) => ({ a: side(a.scenes[i], b.scenes[i]), b: side(b.scenes[i], a.scenes[i]) }))
}
