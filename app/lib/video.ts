import type { Typeset } from '#shared/render'
import type { Cut } from '#shared/studio'
import type { Clip } from '#shared/video'
import { layoutPage } from '#shared/render'
import { bubblesAt, fitRect, frameAt, motionAt } from '#shared/video'
import { paintPage } from './export'

// PUB-30~35: 시각 t의 영상 프레임. 장 렌더러(paintPage)로 그린 장에서 컷을 잘라 움직임·전환을 얹는다
export interface FrameInput {
  clips: Clip[]
  pages: Map<string, Cut[]>
  W: number
  H: number
  page: { w: number, h: number }
  ts: Typeset
  imgs: Map<string, ImageBitmap>
  label: string | null
  watermark: string | null
}
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
interface Source { cv: HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number }

export function frameRenderer(v: FrameInput) {
  const cache = new Map<string, Source>()
  function source(i: number, n: number): Source {
    const key = `${i}:${n}`
    const hit = cache.get(key)
    if (hit) return hit
    const c = v.clips[i]!
    const ids = new Set(c.cuts.map(x => x.panel.id))
    const laid = layoutPage(v.pages.get(c.cuts[0]!.page.id) ?? c.cuts, v.page.w, v.page.h, v.ts).filter(l => ids.has(l.cut.panel.id))
    let left = n
    const shown = laid.map((l) => {
      const bubbles = l.bubbles.slice(0, Math.max(0, left))
      left -= l.bubbles.length
      return { ...l, bubbles }
    })
    const cv = document.createElement('canvas')
    cv.width = v.page.w
    cv.height = v.page.h
    paintPage(cv.getContext('2d')!, shown, v.page.w, v.page.h, v.ts, v.imgs, null, null)
    const r = isPanel(c) && laid[0] ? laid[0].r : { x: 0, y: 0, w: v.page.w, h: v.page.h }
    const pad = r.w === v.page.w ? 0 : 2
    const src = { cv, sx: Math.max(0, r.x - pad), sy: Math.max(0, r.y - pad), sw: Math.min(v.page.w, r.w + pad * 2), sh: Math.min(v.page.h, r.h + pad * 2) }
    cache.set(key, src)
    return src
  }
  const isPanel = (c: Clip) => c.id === c.cuts[0]!.panel.id

  function clip(ctx: Ctx, i: number, n: number, p: number, alpha: number, ox: number, oy: number) {
    const c = v.clips[i]!
    const src = source(i, n)
    const fit = fitRect(src.sw, src.sh, v.W, v.H)
    const m = motionAt(c.motion, c.strength, p)
    const w = fit.w * m.scale
    const h = fit.h * m.scale
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.rect(ox, oy, v.W, v.H)
    ctx.clip()
    ctx.fillStyle = '#fff'
    ctx.fillRect(ox, oy, v.W, v.H)
    ctx.drawImage(src.cv, src.sx, src.sy, src.sw, src.sh, ox + (v.W - w) / 2 + m.dx * v.W, oy + (v.H - h) / 2 + m.dy * v.H, w, h)
    ctx.restore()
  }

  return function draw(ctx: Ctx, t: number) {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, v.W, v.H)
    const f = frameAt(v.clips, t)
    if (!f) return
    const cur = v.clips[f.index]!
    const n = bubblesAt(cur, f.local)
    const p = f.local / cur.durationMs
    if (f.prev) {
      const pc = v.clips[f.prev.index]!
      const e = f.prev.p
      if (cur.transition === 'fade') {
        clip(ctx, f.prev.index, pc.bubbles, 1, 1, 0, 0)
        clip(ctx, f.index, n, p, e, 0, 0)
      }
      else {
        const [dx, dy] = cur.transition === 'pushLeft' ? [v.W, 0] : [0, v.H]
        clip(ctx, f.prev.index, pc.bubbles, 1, 1, -e * dx, -e * dy)
        clip(ctx, f.index, n, p, 1, (1 - e) * dx, (1 - e) * dy)
      }
    }
    else clip(ctx, f.index, n, p, 1, 0, 0)
    // PUB-38: AI 생성 표기·워터마크는 마지막 화면에
    if (f.index === v.clips.length - 1 && (v.label || v.watermark)) {
      ctx.font = '500 30px Pretendard Variable, sans-serif'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = '#71717A'
      if (v.watermark) {
        ctx.textAlign = 'left'
        ctx.fillText(v.watermark, 40, v.H - 40)
      }
      if (v.label) {
        ctx.textAlign = 'right'
        ctx.fillText(v.label, v.W - 40, v.H - 40)
      }
    }
  }
}
