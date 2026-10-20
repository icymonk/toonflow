import type { Character, Style } from './library'
import type { Crop, Cut, Panel } from './studio'
import { describeAppearance, NO_TEXT, stylePrompt, variantFor } from './library'
import { cutRects, pageSize } from './render'

// Illustrate (ILL-01~06·10~12·20·23·40·41)
export const CANDIDATE_DEFAULT = 2

/** ILL-03 생성 입력 스냅숏 */
export interface CandidateInput { scene: string, characterIds: string[], styleId: string | null, styleVersion: number | null, extra: string }
export interface Candidate {
  id: string
  imagePath: string
  width: number
  height: number
  source: 'ai' | 'upload'
  jobId: string
  favorite?: boolean
  hidden?: boolean
  input?: CandidateInput | null
  createdAt?: { toMillis: () => number } | null
}

const SHOT_EN: Record<string, string> = { closeup: 'close-up shot', bust: 'bust shot', full: 'full body shot', wide: 'wide establishing shot', pov: 'point-of-view shot' }

/** 컷 → 이미지 프롬프트. 글자는 넣지 않는다 (ILL-04) */
/** ILL: 그림 안에 테두리·여백을 그리지 않게 (컷 칸은 렌더러가 나눈다) */
export const FULL_BLEED = 'One single full-bleed illustration that fills the whole frame edge to edge. No borders, no white margins, no panel frames, no letterboxing, no split panels.'

/** 컷 칸의 출력 픽셀 크기 (장 비율·배치 기준). 생성 비율을 칸에 맞춰 위·옆 여백과 과한 잘림을 줄인다 */
export function cutSize(cuts: Cut[], cut: Cut, aspect?: string): { w: number, h: number } {
  const { w: W, h: H } = pageSize(aspect)
  const onPage = cuts.filter(c => c.page.id === cut.page.id)
  const r = cutRects(cut.page.layout, onPage.length, W, H)[Math.min(cut.indexInPage, 3)] ?? { w: W, h: H }
  return { w: Math.round(r.w), h: Math.round(r.h) }
}

export function panelPrompt(panel: Panel, chars: Character[], style: Style | null, opts: { extra?: string, leaveRoom?: boolean } = {}) {
  const linked = new Set(chars.flatMap(c => [c.name, ...c.aliases]))
  const others = panel.characterNames.filter(n => !linked.has(n))
  return [
    style ? `${stylePrompt(style)}.` : 'Korean Instagram webtoon (instatoon) style.',
    `Scene: ${panel.scene}`,
    panel.place && `Place/time: ${panel.place}`,
    panel.shot && SHOT_EN[panel.shot],
    panel.expression && `Expression: ${panel.expression}`,
    panel.action && `Action: ${panel.action}`,
    panel.outfit && `Outfit: ${panel.outfit}`,
    panel.mood && `Mood/effects: ${panel.mood}`,
    ...chars.map(c => `Character "${c.name}": ${c.appearanceText || describeAppearance(c.appearance)}`),
    others.length ? `Other characters: ${others.join(', ')}` : '',
    opts.leaveRoom ? 'Leave some empty space near the top for speech bubbles.' : '',
    FULL_BLEED,
    NO_TEXT,
    opts.extra ? `Additional request: ${opts.extra}` : '',
  ].filter(Boolean).join('\n')
}

/** 캐릭터 대표 이미지 → 그림체 참조 순, 최대 5장 */
export const panelRefPaths = (chars: Character[], style: Style | null, panel?: { expression?: string, outfit?: string }) =>
  [...chars.map(c => variantFor(c, panel)).filter((p): p is string => !!p), ...(style?.refImages ?? [])].slice(0, 5)

/** 후보 id는 `${jobId}_${i}` (apply.ts), 그림은 작업 결과 경로 */
export const candidatePath = (wsId: string, candidateId: string) => {
  const i = candidateId.lastIndexOf('_')
  return `workspaces/${wsId}/aiJobs/${candidateId.slice(0, i)}/${candidateId.slice(i + 1)}.png`
}

/** ILL-23: 확대(1~3)와 중심(0~1) → 잘라낼 영역 */
export function zoomCrop(zoom: number, cx: number, cy: number): Crop {
  const w = 1 / Math.max(1, zoom)
  return { x: (1 - w) * cx, y: (1 - w) * cy, w, h: w }
}
export const cropStyle = (c?: Crop | null) => (c
  ? { position: 'absolute' as const, maxWidth: 'none', width: `${100 / c.w}%`, height: `${100 / c.h}%`, left: `${(-c.x / c.w) * 100}%`, top: `${(-c.y / c.h) * 100}%` }
  : { position: 'absolute' as const, inset: '0', width: '100%', height: '100%' })

/** ILL-02 한꺼번에: 그림 없는 컷 / 영향 받은 컷 */
export const bulkTargets = (cuts: Cut[], mode: 'empty' | 'stale', busy: ReadonlySet<string | undefined>) =>
  cuts.filter(c => !busy.has(c.panel.id) && (mode === 'empty' ? !c.panel.selectedCandidateId : !!c.panel.staleFrom))
