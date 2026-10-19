import type { Cut } from './studio'

// PUB-30~38 릴스용 슬라이드 영상. 시간은 ms, 좌표는 화면 비율
export const VIDEO_SIZES = { '9:16': { w: 1080, h: 1920 }, '4:5': { w: 1080, h: 1350 } } as const
export type VideoAspect = keyof typeof VIDEO_SIZES
export const FPS = 30
/** 인스타그램 릴스 길이 상한 (3분, 2025-01 발표 기준). 바뀌면 여기만 */
export const REELS_MAX_MS = 180_000
export const MIN_CLIP_MS = 500
export const MAX_CLIP_MS = 10_000

export const MOTIONS = ['none', 'zoomIn', 'zoomOut', 'panX', 'panY'] as const
export type Motion = (typeof MOTIONS)[number]
export const STRENGTHS = { weak: 0.06, mid: 0.12, strong: 0.2 } as const
export type Strength = keyof typeof STRENGTHS
export const TRANSITIONS = ['cut', 'fade', 'pushLeft', 'pushUp'] as const
export type Transition = (typeof TRANSITIONS)[number]
export type Reveal = 'together' | 'sequence'

export interface ClipSettings { durationMs: number, motion: Motion, strength: Strength, transition: Transition, transitionMs: number, reveal: Reveal }
export interface VideoSettings {
  aspect: VideoAspect
  unit: 'panel' | 'page'
  clips: Record<string, Partial<ClipSettings>>
  musicPath: string | null
  musicVolume: number
  musicFadeOutMs: number
  musicLoop: boolean
  coverId: string | null
}
export const DEFAULT_VIDEO: VideoSettings = { aspect: '9:16', unit: 'panel', clips: {}, musicPath: null, musicVolume: 0.8, musicFadeOutMs: 2000, musicLoop: true, coverId: null }

export const clampMs = (ms: number) => Math.round(Math.min(MAX_CLIP_MS, Math.max(MIN_CLIP_MS, ms)) / 100) * 100

/** PUB-32: 대사 없는 컷 1.5초, 있으면 1.2초 + 글자당 0.07초 */
export function suggestMs(chars: number): number {
  return chars ? clampMs(1200 + chars * 70) : 1500
}

export interface Clip extends ClipSettings { id: string, cuts: Cut[], bubbles: number, start: number }

/** 컷 순서대로 타임라인. 장 단위면 장 하나가 한 클립 */
export function buildClips(cuts: Cut[], v: Pick<VideoSettings, 'unit' | 'clips'>): Clip[] {
  const groups: Cut[][] = []
  for (const c of cuts) {
    const last = groups.at(-1)
    if (v.unit === 'page' && last && last[0]!.page.id === c.page.id) last.push(c)
    else groups.push([c])
  }
  let start = 0
  return groups.map((g, i) => {
    const id = v.unit === 'page' ? g[0]!.page.id : g[0]!.panel.id
    const dialogues = g.flatMap(c => c.panel.dialogues)
    const o = v.clips[id] ?? {}
    const clip: Clip = {
      id,
      cuts: g,
      bubbles: dialogues.length,
      start,
      durationMs: clampMs(o.durationMs ?? suggestMs(dialogues.reduce((n, d) => n + d.text.length, 0))),
      motion: o.motion ?? 'none',
      strength: o.strength ?? 'mid',
      transition: i === 0 ? 'cut' : (o.transition ?? 'fade'),
      transitionMs: Math.min(1000, Math.max(100, o.transitionMs ?? 300)),
      reveal: o.reveal ?? 'together',
    }
    start += clip.durationMs
    return clip
  })
}

export const totalMs = (clips: Clip[]) => clips.reduce((n, c) => n + c.durationMs, 0)

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2)

/** PUB-33: 클립 진행 0~1에서 확대 배율과 이동(화면 비율) */
export function motionAt(motion: Motion, strength: Strength, p: number): { scale: number, dx: number, dy: number } {
  const s = STRENGTHS[strength]
  const e = ease(Math.min(1, Math.max(0, p)))
  if (motion === 'zoomIn') return { scale: 1 + s * e, dx: 0, dy: 0 }
  if (motion === 'zoomOut') return { scale: 1 + s * (1 - e), dx: 0, dy: 0 }
  if (motion === 'panX') return { scale: 1 + s, dx: s * (0.5 - e), dy: 0 }
  if (motion === 'panY') return { scale: 1 + s, dx: 0, dy: s * (0.5 - e) }
  return { scale: 1, dx: 0, dy: 0 }
}

/** PUB-35: 보일 말풍선 수 */
export const bubblesAt = (c: Pick<Clip, 'reveal' | 'bubbles' | 'durationMs'>, local: number) =>
  c.reveal === 'together' || !c.bubbles ? c.bubbles : Math.min(c.bubbles, 1 + Math.floor((local / c.durationMs) * c.bubbles))

export interface FrameState {
  index: number
  local: number
  /** 전환 중이면 이전 클립 번호와 전환 진행 0~1 */
  prev: { index: number, p: number } | null
}
/** 시각 t(ms)에 보일 클립. 전환은 새 클립 앞부분에서 이전 클립 마지막 모습 위로 */
export function frameAt(clips: Clip[], t: number): FrameState | null {
  if (!clips.length) return null
  const time = Math.min(Math.max(0, t), totalMs(clips) - 1)
  let index = clips.findIndex(c => time < c.start + c.durationMs)
  if (index < 0) index = clips.length - 1
  const c = clips[index]!
  const local = time - c.start
  const prev = index > 0 && c.transition !== 'cut' && local < c.transitionMs ? { index: index - 1, p: local / c.transitionMs } : null
  return { index, local, prev }
}

/** 안쪽 그림을 화면에 맞춰 넣을 크기 (가운데, 여백 4%) */
export function fitRect(w: number, h: number, W: number, H: number) {
  const sc = Math.min((W * 0.96) / w, (H * 0.96) / h)
  return { x: (W - w * sc) / 2, y: (H - h * sc) / 2, w: w * sc, h: h * sc }
}

export const fmtSec = (ms: number) => `${(ms / 1000).toFixed(1)}초`
