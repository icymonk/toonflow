import { z } from 'zod'

// 캐릭터 (CHR-01·02·04·07·09~11) · 그림체 (STL-01·02·04·09) — 워크스페이스 공용
interface Ts { toMillis: () => number }
const str = (max: number) => z.string().trim().max(max)

export const APPEARANCE_KEYS = ['age', 'gender', 'build', 'hair', 'eyes', 'marks', 'outfit'] as const
export type AppearanceKey = (typeof APPEARANCE_KEYS)[number]
export const APPEARANCE_LABEL: Record<AppearanceKey, string> = { age: '나이대', gender: '성별 표현', build: '키·체형', hair: '머리', eyes: '눈', marks: '특징', outfit: '기본 의상' }

export const characterInput = z.object({
  name: str(30).min(1),
  aliases: z.array(str(30).min(1)).max(5),
  intro: str(100),
  appearance: z.object({ age: str(60), gender: str(60), build: str(60), hair: str(60), eyes: str(60), marks: str(60), outfit: str(60) }),
  appearanceText: str(600),
  /** CHR-03 */
  personality: str(100).optional(),
  speech: z.array(str(80)).max(3).optional(),
  /** CHR-10: 이번 에피소드만 쓰는 단역이면 에피소드 id */
  episodeId: z.string().nullable(),
})
export type CharacterInput = z.infer<typeof characterInput>
export interface Character extends CharacterInput {
  id: string
  refImages: string[]
  coverPath: string | null
  /** CHR-06 */
  variants?: CharacterVariant[]
  archivedAt?: Ts | null
  deletedAt?: Ts | null
}
export const emptyAppearance = (): CharacterInput['appearance'] => ({ age: '', gender: '', build: '', hair: '', eyes: '', marks: '', outfit: '' })

/** CHR-02: 그림 생성에 넘길 외형 설명 */
export const describeAppearance = (a: CharacterInput['appearance']) =>
  APPEARANCE_KEYS.filter(k => a[k]?.trim()).map(k => `${APPEARANCE_LABEL[k]} ${a[k]!.trim()}`).join(', ')

/** SBD-12: 콘티의 인물 이름을 캐릭터(이름·역할 이름)에 연결 */
export function matchCharacters(names: string[], chars: Character[]): string[] {
  const norm = (s: string) => s.replace(/\s/g, '').toLowerCase()
  const live = chars.filter(c => !c.deletedAt)
  const ids = names.map((n) => {
    const key = norm(n)
    return live.find(c => [c.name, ...c.aliases].some(x => norm(x) === key))?.id
  })
  return [...new Set(ids.filter((id): id is string => !!id))]
}

export const LINES = ['thin', 'bold', 'none'] as const
export const COLORINGS = ['flat', 'watercolor', 'cel'] as const
export const PALETTES = ['pastel', 'vivid', 'mono', 'custom'] as const
export const BACKGROUNDS = ['plain', 'simple', 'detailed'] as const

export const styleInput = z.object({
  name: str(30).min(1),
  description: str(500),
  line: z.enum(LINES),
  coloring: z.enum(COLORINGS),
  palette: z.enum(PALETTES),
  paletteColors: str(100),
  background: z.enum(BACKGROUNDS),
  negative: str(300),
  /** STL-02: 내가 권리를 가진 그림인지 확인 */
  rightsConfirmed: z.boolean(),
})
export type StyleInput = z.infer<typeof styleInput>
export interface Style extends StyleInput {
  id: string
  refImages: string[]
  samples?: string[]
  sampleJobId?: string
  version: number
  archivedAt?: Ts | null
  deletedAt?: Ts | null
}
export const defaultStyle = (): StyleInput => ({ name: '새 그림체', description: '', line: 'thin', coloring: 'flat', palette: 'pastel', paletteColors: '', background: 'simple', negative: '', rightsConfirmed: false })

const EN = {
  line: { thin: 'thin clean line art', bold: 'bold thick outlines', none: 'no outlines (lineless)' },
  coloring: { flat: 'flat colors', watercolor: 'soft watercolor shading', cel: 'cel shading' },
  palette: { pastel: 'pastel palette', vivid: 'vivid saturated palette', mono: 'black and white monochrome', custom: 'custom palette' },
  background: { plain: 'plain single-color background', simple: 'simple background', detailed: 'detailed background' },
} as const

/** 그림체 → 이미지 프롬프트 */
export function stylePrompt(s: StyleInput): string {
  const palette = s.palette === 'custom' && s.paletteColors ? `palette: ${s.paletteColors}` : EN.palette[s.palette]
  return [`Korean Instagram webtoon (instatoon) style`, EN.line[s.line], EN.coloring[s.coloring], palette, EN.background[s.background], s.description].filter(Boolean).join(', ')
}

/** STL-04: 같은 기준 장면 3개 */
export const SAMPLE_SCENES = [
  'a young office worker standing full body, waving hello in a bright room',
  'background focus: a quiet alley street at dusk, with a small figure walking',
  'close-up of a surprised face, eyes wide open',
] as const
export const NO_TEXT = 'Do not draw any text, letters, numbers, signs, or speech bubbles.'

export const stylePrompts = (s: StyleInput) => SAMPLE_SCENES.map(scene => `${stylePrompt(s)}. Scene: ${scene}. ${NO_TEXT}`)

/** CHR-04: 캐릭터 대표 이미지 후보 */
export const characterPrompt = (c: CharacterInput, s: StyleInput | null) =>
  `${s ? `${stylePrompt(s)}. ` : ''}Character reference sheet of "${c.name}": ${c.appearanceText || describeAppearance(c.appearance)}. Front view, full body, neutral pose, white background. ${NO_TEXT}`

/** 이미지 작업 params (style.sample · panel.image) */
export const imageParams = z.object({
  prompt: z.string().max(4000).optional(),
  prompts: z.array(z.string().max(4000)).min(1).max(6).optional(),
  n: z.number().int().min(1).max(4).optional(),
  negative: z.string().max(300).nullish(),
  refPaths: z.array(z.string()).max(5).nullish(),
})
export const imageCount = (p: Record<string, unknown>) => {
  const q = imageParams.safeParse(p)
  if (!q.success) return 1
  return (q.data.prompts?.length ?? 1) * (q.data.n ?? 1)
}

/** CHR-06: 표정·의상별 참조 이미지 */
export interface CharacterVariant { kind: 'expression' | 'outfit', label: string, path: string }
/** 컷의 표정·의상 글에 이름이 들어 있는 참조 이미지, 없으면 대표 이미지 */
export function variantFor(c: Character, panel?: { expression?: string, outfit?: string }): string | null {
  const hit = (kind: CharacterVariant['kind'], text?: string) =>
    text?.trim() ? (c.variants ?? []).find(v => v.kind === kind && v.label.trim() && text.includes(v.label.trim()))?.path : undefined
  return hit('expression', panel?.expression) ?? hit('outfit', panel?.outfit) ?? c.coverPath
}

/** CHR-05 캐릭터 시트 */
export const SHEET = [
  { label: '정면', kind: 'view', hint: '정면을 바라보는 상반신, 무표정' },
  { label: '옆모습', kind: 'view', hint: '옆모습(측면) 상반신' },
  { label: '전신', kind: 'view', hint: '정면 전신, 서 있는 자세' },
  { label: '기쁨', kind: 'expression', hint: '활짝 웃는 표정 상반신' },
  { label: '화남', kind: 'expression', hint: '화난 표정 상반신' },
  { label: '놀람', kind: 'expression', hint: '깜짝 놀란 표정 상반신' },
] as const
/** CHR-12 일관성 테스트 장면 */
export const CONSISTENCY_SCENES = ['카페에서 커피를 마시는 장면', '퇴근길 지하철에서 휴대폰을 보는 장면', '집 소파에 누워 있는 장면', '사무실 책상에서 일하는 장면'] as const
export const withHint = (base: string, hint: string, sheet = false) =>
  `${base}\n\n이번 그림: ${hint}.${sheet ? ' 단색 배경의 캐릭터 설정화.' : ''}`.slice(0, 4000)
