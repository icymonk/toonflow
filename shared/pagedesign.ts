import { z } from 'zod'
import { wrapText } from './render'

/** PUB-15~17 표지 장·끝장 디자인 (라이브러리). 장 수에 함께 센다 */
export const DESIGN_KINDS = ['cover', 'outro'] as const
export type DesignKind = (typeof DESIGN_KINDS)[number]
export const DESIGN_ALIGNS = ['top', 'center', 'bottom'] as const
export type DesignAlign = (typeof DESIGN_ALIGNS)[number]
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/)

export const pageDesignInput = z.object({
  name: z.string().trim().min(1).max(30),
  bgColor: hex,
  textColor: hex,
  align: z.enum(DESIGN_ALIGNS),
  showSeries: z.boolean(),
  showNumber: z.boolean(),
  showTitle: z.boolean(),
  text: z.string().max(300),
  titleSize: z.number().int().min(40).max(160),
  textSize: z.number().int().min(20).max(80),
  boxed: z.boolean(),
})
export type PageDesignInput = z.infer<typeof pageDesignInput>
export interface PageDesign extends PageDesignInput {
  id: string
  kind: DesignKind
  imagePath: string | null
  seriesId: string | null
  archivedAt?: unknown
  deletedAt?: unknown
}

export function defaultDesign(kind: DesignKind): PageDesignInput {
  return kind === 'cover'
    ? { name: '새 표지', bgColor: '#FFFFFF', textColor: '#1F2A44', align: 'center', showSeries: true, showNumber: true, showTitle: true, text: '', titleSize: 112, textSize: 40, boxed: false }
    : { name: '새 끝장', bgColor: '#FFFFFF', textColor: '#1F2A44', align: 'center', showSeries: false, showNumber: false, showTitle: false, text: '읽어 주셔서 고마워요\n다음 화도 기대해 주세요', titleSize: 72, textSize: 40, boxed: false }
}

export interface DesignInfo { series: string, number: number, title: string }
export interface DesignLine { text: string, y: number, size: number, bold: boolean }
export interface LaidDesign { lines: DesignLine[], box: { x: number, y: number, w: number, h: number } | null }

const LH = 1.3
const MARGIN = 72

/** 글 줄과 위치. 화면(SVG)과 출력(Canvas)이 같이 쓴다 */
export function layoutDesign(d: PageDesignInput, info: DesignInfo, W: number, H: number): LaidDesign {
  const wrap = (text: string, size: number) => text.split('\n').flatMap(l => (l.trim() ? wrapText(l.trim(), Math.max(4, Math.floor((W - MARGIN * 2) / size))) : ['']))
  const rows: { text: string, size: number, bold: boolean }[] = []
  const add = (text: string, size: number, bold: boolean) => wrap(text, size).forEach(t => rows.push({ text: t, size, bold }))
  const num = `${info.number}화`
  if (d.showSeries && info.series) add(info.series, Math.round(d.titleSize * 0.45), false)
  if (d.showNumber) add(num, Math.round(d.titleSize * 0.6), true)
  // 제목을 비워 두면 "N화"가 제목이라 두 번 쓰지 않는다
  if (d.showTitle && info.title && !(d.showNumber && info.title.trim() === num)) add(info.title, d.titleSize, true)
  if (d.text.trim()) add(d.text, d.textSize, false)
  const hs = rows.map(r => r.size * LH)
  const total = hs.reduce((a, b) => a + b, 0)
  const top = d.align === 'top' ? H * 0.1 : d.align === 'bottom' ? H * 0.9 - total : (H - total) / 2
  let y = top
  const lines = rows.map((r, i) => {
    const line = { ...r, y: y + hs[i]! / 2 }
    y += hs[i]!
    return line
  })
  const pad = 32
  return { lines, box: d.boxed && rows.length ? { x: MARGIN - pad, y: top - pad, w: W - (MARGIN - pad) * 2, h: total + pad * 2 } : null }
}

/** 에피소드 설정에서 "작품 기본 따르기" */
export const DESIGN_FROM_SERIES = 'series'

/** 에피소드 값이 없으면 작품 기본값, 빈 값이면 끔 */
export function pickDesign(episodeId: string | null | undefined, seriesId: string | null | undefined, list: PageDesign[], kind: DesignKind): PageDesign | null {
  const id = episodeId === undefined ? seriesId : episodeId
  return (id && list.find(d => d.id === id && d.kind === kind && !d.deletedAt)) || null
}
