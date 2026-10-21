import type { Adjust } from './studio'
import { findPii } from './privacy'
import type { Cut, Dialogue, DialogueType, Page, PageLayout, Panel } from './studio'
import { LAYOUT_BY_COUNT, MAX_PANELS_PER_PAGE, rowsOf } from './studio'

// 장 렌더러 공용 계산 (R5, REV-01~04·11). 좌표: 장은 출력 픽셀, 말풍선은 컷 안 0~1 비율
export const PAGE_SIZES: Record<string, { w: number, h: number }> = { '4:5': { w: 1080, h: 1350 }, '1:1': { w: 1080, h: 1080 }, '3:4': { w: 1080, h: 1440 } }
export const pageSize = (aspect?: string) => PAGE_SIZES[aspect ?? '4:5'] ?? PAGE_SIZES['4:5']!

export const PAGE_MARGIN = 24
export const PANEL_GAP = 16
export interface Rect { x: number, y: number, w: number, h: number }

/** top: 장 제목 띠(SBD-25)가 차지하는 높이 */
export function cutRects(layout: PageLayout, count: number, W: number, H: number, top = 0): Rect[] {
  const m = PAGE_MARGIN
  const g = PANEL_GAP
  const iw = W - 2 * m
  const ih = H - 2 * m - top
  const grid = (rows: number[]) => {
    const rh = (ih - g * (rows.length - 1)) / rows.length
    return rows.flatMap((c, r) => {
      const cw = (iw - g * (c - 1)) / c
      return Array.from({ length: c }, (_, i) => ({ x: m + i * (cw + g), y: m + top + r * (rh + g), w: cw, h: rh }))
    })
  }
  const n = Math.max(1, Math.min(MAX_PANELS_PER_PAGE, count))
  const rows = rowsOf(layout, n)
  if (rows) return grid(rows)
  if (n === 1 || layout === '1') return grid([1])
  if (n === 2 && layout === '2h') return grid([2])
  if (n <= 4 && (n === 4 || layout === '4')) return grid([2, 2]).slice(0, n)
  if (n <= 4) return grid(Array.from({ length: n }, () => 1))
  return grid(rowsOf(LAYOUT_BY_COUNT[n]!, n)!)
}

/** SBD-25 장 제목 띠 높이 (제목이 없으면 0) */
export const titleBand = (page: Pick<Page, 'title'> | undefined, H: number) => (page?.title?.trim() ? Math.round(H * 0.1) : 0)
/** 한 장의 컷 칸들 (제목 띠 아래) */
export const pageRects = (cuts: Cut[], W: number, H: number) => cutRects(cuts[0]?.page.layout ?? '1', cuts.length, W, H, titleBand(cuts[0]?.page, H))
export interface LaidTitle { text: string, x: number, y: number, size: number }
export function layoutTitle(page: Pick<Page, 'title'> | undefined, W: number, H: number): LaidTitle | null {
  const text = page?.title?.trim()
  if (!text) return null
  const band = titleBand(page, H)
  const size = Math.round(Math.min(band * 0.62, ((W - 2 * PAGE_MARGIN - 32) / Math.max(1, [...text].length)) * 1.1))
  return { text, x: W / 2, y: PAGE_MARGIN + (band - PANEL_GAP) / 2, size }
}
/** 콘티 보기·미리보기 썸네일용: 칸 위치를 장 대비 %로 */
export function cutBoxes(cuts: Cut[], W: number, H: number) {
  const pct = (v: number, of: number) => `${(v / of) * 100}%`
  const band = titleBand(cuts[0]?.page, H)
  return {
    title: band ? { left: pct(PAGE_MARGIN, W), right: pct(PAGE_MARGIN, W), top: pct(PAGE_MARGIN, H), height: pct(band - PANEL_GAP, H) } : null,
    cuts: pageRects(cuts, W, H).map(r => ({ left: pct(r.x, W), top: pct(r.y, H), width: pct(r.w, W), height: pct(r.h, H) })),
  }
}

export type BubbleTail = 'none' | 'bl' | 'b' | 'br' | 'tl' | 'tr'
export const BUBBLE_TAILS: BubbleTail[] = ['none', 'bl', 'b', 'br', 'tl', 'tr']
/** REV-07 말풍선 템플릿: 자주 쓰는 모양·크기·글자 (효과음 포함) */
export interface BubbleStyle { shape: DialogueType, tail: BubbleTail, fontSize: number, bold: boolean, w: number, h: number }
export interface BubbleTemplate extends BubbleStyle { id: string, name: string }
export const bubbleStyle = (b: BubbleStyle): BubbleStyle => ({ shape: b.shape, tail: b.tail, fontSize: b.fontSize, bold: b.bold, w: b.w, h: b.h })
export interface Bubble { dialogueId: string, x: number, y: number, w: number, h: number, shape: DialogueType, tail: BubbleTail, fontSize: number, bold: boolean }

// REV-04 상업 이용 가능한 무료 글꼴 (SIL OFL 1.1)
export const FONTS = [
  { id: 'pretendard', label: 'Pretendard', css: 'Pretendard Variable, Pretendard, sans-serif', license: 'SIL OFL 1.1' },
  { id: 'gowun-dodum', label: '고운돋움', css: '"Gowun Dodum", sans-serif', license: 'SIL OFL 1.1' },
  { id: 'jua', label: '주아', css: 'Jua, sans-serif', license: 'SIL OFL 1.1' },
] as const
export type FontId = (typeof FONTS)[number]['id']
export interface Typeset { font: FontId, fontSize: number, lineHeight: number, strokeWidth: number, strokeColor: string }
export const DEFAULT_TYPESET: Typeset = { font: 'pretendard', fontSize: 34, lineHeight: 1.3, strokeWidth: 3, strokeColor: '#1F2A44' }
export const fontCss = (id?: string) => (FONTS.find(f => f.id === id) ?? FONTS[0]).css
export const MIN_FONT = 24

/** 글자 수 기준 줄바꿈. 줄바꿈 문자는 그대로, 긴 줄은 띄어쓰기에서 자른다 */
export function wrapText(text: string, maxChars: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word
      if (next.length <= maxChars || !line) line = next
      else {
        out.push(line)
        line = word
      }
      while (line.length > maxChars) {
        out.push(line.slice(0, maxChars))
        line = line.slice(maxChars)
      }
    }
    out.push(line)
  }
  return out
}

const PAD = 1.6 // 글자 크기 대비 말풍선 안쪽 여백 배수
export function bubbleSize(text: string, fontSize: number, shape: DialogueType, rect: Rect) {
  const maxChars = shape === 'narration' ? 18 : 9
  const lines = wrapText(text || ' ', maxChars)
  const longest = Math.max(...lines.map(l => l.length), 1)
  const pw = longest * fontSize + fontSize * PAD * (shape === 'narration' ? 1 : 2)
  const ph = lines.length * fontSize * DEFAULT_TYPESET.lineHeight + fontSize * PAD * (shape === 'narration' ? 1 : 1.6)
  return { w: Math.min(0.9, pw / rect.w), h: Math.min(0.9, ph / rect.h) }
}

/** REV-01: 대사 순서대로 위→아래, 왼→오른 번갈아. 내레이션은 위 왼쪽 상자 */
export function autoPlace(dialogues: Dialogue[], rect: Rect, fontSize: number): Bubble[] {
  let y = 0.04
  return dialogues.map((d, i) => {
    const { w, h } = bubbleSize(d.text, fontSize, d.type, rect)
    const left = d.type === 'narration' || i % 2 === 0
    const b: Bubble = {
      dialogueId: d.id,
      x: left ? 0.04 : Math.max(0.04, 0.96 - w),
      y: Math.min(y, Math.max(0, 0.96 - h)),
      w,
      h,
      shape: d.type,
      tail: d.type === 'narration' || d.type === 'sfx' ? 'none' : left ? 'br' : 'bl',
      fontSize: d.type === 'sfx' ? Math.round(fontSize * 1.6) : fontSize,
      bold: d.type === 'shout' || d.type === 'sfx',
    }
    y += h + 0.03
    return b
  })
}

/** 대사가 바뀌면 말풍선을 맞춘다: 지운 대사의 말풍선은 빼고, 새 대사는 자동 배치 자리로 */
export function syncBubbles(panel: Pick<Panel, 'dialogues'> & { bubbles?: Bubble[] | null }, rect: Rect, fontSize: number): Bubble[] {
  const auto = autoPlace(panel.dialogues, rect, fontSize)
  const have = new Map((panel.bubbles ?? []).map(b => [b.dialogueId, b]))
  return auto.map(a => have.get(a.dialogueId) ?? a)
}

export type CheckKind = 'noImage' | 'outside' | 'smallText' | 'noBubble' | 'pii'
export interface CheckIssue { kind: CheckKind, panelId: string, number: number, dialogueId?: string }
/** REV-11 자동 점검 (그림·말풍선). bubblesOf: 화면·출력에 실제로 그려지는 말풍선 (저장 안 된 대사는 자동 자리) */
export function autoCheck(cuts: Cut[], bubblesOf?: (cut: Cut) => Bubble[]): CheckIssue[] {
  const out: CheckIssue[] = []
  for (const c of cuts) {
    const p = c.panel as Panel & { bubbles?: Bubble[] | null }
    if (!p.selectedCandidateId) out.push({ kind: 'noImage', panelId: p.id, number: c.number })
    const bs = new Map((bubblesOf ? bubblesOf(c) : (p.bubbles ?? [])).map(b => [b.dialogueId, b]))
    for (const d of p.dialogues) {
      if (findPii(d.text).length) out.push({ kind: 'pii', panelId: p.id, number: c.number, dialogueId: d.id })
      const b = bs.get(d.id)
      if (!b) out.push({ kind: 'noBubble', panelId: p.id, number: c.number, dialogueId: d.id })
      else if (b.x < -0.001 || b.y < -0.001 || b.x + b.w > 1.001 || b.y + b.h > 1.001) out.push({ kind: 'outside', panelId: p.id, number: c.number, dialogueId: d.id })
      else if (b.fontSize < MIN_FONT) out.push({ kind: 'smallText', panelId: p.id, number: c.number, dialogueId: d.id })
    }
  }
  return out
}

/** 꼬리 삼각형 (컷 좌표 px) */
export function tailPoints(b: { x: number, y: number, w: number, h: number }, tail: BubbleTail): string | null {
  if (tail === 'none') return null
  const top = tail.startsWith('t')
  const fx = tail.endsWith('l') ? 0.3 : tail.endsWith('r') ? 0.7 : 0.5
  const bx = b.x + b.w * fx
  const by = top ? b.y + b.h * 0.15 : b.y + b.h * 0.85
  const tipX = bx + (tail.endsWith('l') ? -1 : tail.endsWith('r') ? 1 : 0) * b.w * 0.15
  const tipY = top ? b.y - b.h * 0.35 : b.y + b.h * 1.35
  const half = Math.max(8, b.w * 0.06)
  return `${bx - half},${by} ${bx + half},${by} ${tipX},${tipY}`
}

/** 외침 말풍선의 뾰족한 테두리 */
export function spikyPath(b: { x: number, y: number, w: number, h: number }, spikes = 14): string {
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const pts: string[] = []
  for (let i = 0; i < spikes * 2; i++) {
    const a = (Math.PI * i) / spikes
    const r = i % 2 ? 0.86 : 1.08
    pts.push(`${(cx + Math.cos(a) * (b.w / 2) * r).toFixed(1)},${(cy + Math.sin(a) * (b.h / 2) * r).toFixed(1)}`)
  }
  return `M${pts.join('L')}Z`
}

export interface LaidBubble { b: Bubble, px: Rect, lines: string[], lh: number, tail: string | null }
export interface LaidCut { cut: Cut, r: Rect, img: Rect, bubbles: LaidBubble[] }
/** 화면(SVG)·출력(Canvas) 공용 배치 계산 */
export function layoutPage(cuts: Cut[], W: number, H: number, ts: Typeset, override?: (panelId: string, b: Bubble) => Bubble): LaidCut[] {
  const rects = pageRects(cuts, W, H)
  return cuts.map((cut, i) => {
    const r = rects[i]!
    const crop = cut.panel.crop
    const img = crop ? { x: r.x - (crop.x / crop.w) * r.w, y: r.y - (crop.y / crop.h) * r.h, w: r.w / crop.w, h: r.h / crop.h } : r
    const bubbles = syncBubbles(cut.panel, r, ts.fontSize).map(b0 => override?.(cut.panel.id, b0) ?? b0).map((b) => {
      const px = { x: r.x + b.x * r.w, y: r.y + b.y * r.h, w: b.w * r.w, h: b.h * r.h }
      const text = cut.panel.dialogues.find(d => d.id === b.dialogueId)?.text ?? ''
      const lines = wrapText(text, Math.max(1, Math.floor((px.w - b.fontSize * (b.shape === 'narration' ? 1 : 2)) / b.fontSize)))
      return { b, px, lines, lh: b.fontSize * ts.lineHeight, tail: tailPoints(px, b.tail) }
    })
    return { cut, r, img, bubbles }
  })
}

// PUB-03·05·13
/** 인스타그램 한 게시물 최대 장수 (현재 20). 바뀌면 여기만 */
export const POST_LIMIT = 20
export const AI_LABEL = 'AI 생성 이미지 포함'
export const AI_CAPTION = '이 게시물에는 AI로 생성한 이미지가 포함되어 있어요. #AI생성'
const safe = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '') || 'toonflow'
export const exportName = (series: string, episode: number, page: number, ext: string) => `${safe(series)}_${episode}화_${String(page).padStart(2, '0')}.${ext}`
export const splitBatches = <T>(items: T[], limit = POST_LIMIT): T[][] =>
  items.length <= limit ? [items] : Array.from({ length: Math.ceil(items.length / limit) }, (_, i) => items.slice(i * limit, (i + 1) * limit))

/** ILL-24 화면(CSS)·출력(Canvas) 공용 보정 필터 */
export const adjustFilter = (a?: Adjust | null) => (a ? `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturate}%)` : 'none')
