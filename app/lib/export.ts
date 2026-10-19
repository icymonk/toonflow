import type { LaidCut, Typeset } from '#shared/render'
import type { Firestore } from 'firebase/firestore'
import type { FirebaseStorage } from 'firebase/storage'
import type { CandidateRef } from './candidates'
import { getBlob, ref as storageRef } from 'firebase/storage'
import { fontCss, spikyPath } from '#shared/render'
import { resolveCandidatePath } from './candidates'

const INK = '#1F2A44'

// PUB-03: 장 렌더러와 같은 배치(layoutPage)를 Canvas에 그려 JPG/PNG로
export async function drawPage(laid: LaidCut[], W: number, H: number, ts: Typeset, imgs: Map<string, ImageBitmap>, label: string | null, watermark: string | null, type: 'image/jpeg' | 'image/png'): Promise<Blob> {
  await loadFonts(ts)
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  paintPage(cv.getContext('2d')!, laid, W, H, ts, imgs, label, watermark)
  return new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), type, 0.92))
}

export async function loadFonts(ts: Typeset) {
  const font = fontCss(ts.font)
  await Promise.all([document.fonts.load(`500 ${ts.fontSize}px ${font}`), document.fonts.load(`700 ${ts.fontSize}px ${font}`)]).catch(() => {})
}

/** 장 하나를 ctx에 그린다. 영상 프레임(app/lib/video.ts)도 이걸 쓴다 */
export function paintPage(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, laid: LaidCut[], W: number, H: number, ts: Typeset, imgs: Map<string, ImageBitmap>, label: string | null, watermark: string | null) {
  const font = fontCss(ts.font)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)
  for (const it of laid) {
    const { r } = it
    ctx.save()
    ctx.beginPath()
    ctx.rect(r.x, r.y, r.w, r.h)
    ctx.clip()
    ctx.fillStyle = '#F4F4F5'
    ctx.fillRect(r.x, r.y, r.w, r.h)
    const img = it.cut.panel.selectedCandidateId ? imgs.get(it.cut.panel.selectedCandidateId) : undefined
    if (img) {
      const sc = Math.max(it.img.w / img.width, it.img.h / img.height)
      const dw = img.width * sc
      const dh = img.height * sc
      ctx.drawImage(img, it.img.x + (it.img.w - dw) / 2, it.img.y + (it.img.h - dh) / 2, dw, dh)
    }
    for (const lb of it.bubbles) {
      const { b, px } = lb
      ctx.strokeStyle = INK
      ctx.lineJoin = 'round'
      ctx.setLineDash([])
      if (b.shape !== 'sfx') {
        ctx.lineWidth = 3
        if (lb.tail && b.shape !== 'thought') {
          const pts = lb.tail.split(' ').map(p => p.split(',').map(Number) as [number, number])
          ctx.beginPath()
          pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
          ctx.closePath()
          ctx.fillStyle = '#fff'
          ctx.fill()
          ctx.stroke()
        }
        const path = b.shape === 'narration' ? (() => { const p = new Path2D(); p.rect(px.x, px.y, px.w, px.h); return p })()
          : b.shape === 'shout' ? new Path2D(spikyPath(px))
            : (() => { const p = new Path2D(); p.ellipse(px.x + px.w / 2, px.y + px.h / 2, px.w / 2, px.h / 2, 0, 0, Math.PI * 2); return p })()
        ctx.fillStyle = b.shape === 'narration' ? '#FFF8E7' : '#fff'
        ctx.fill(path)
        ctx.lineWidth = b.shape === 'shout' ? 4 : 3
        if (b.shape === 'whisper') ctx.setLineDash([10, 8])
        ctx.stroke(path)
        ctx.setLineDash([])
        if (b.shape === 'thought' && b.tail !== 'none') {
          const top = b.tail.startsWith('t')
          for (const [dx, dy, rr] of [[0, 14, 10], [16, 38, 6]] as const) {
            ctx.beginPath()
            ctx.arc(px.x + px.w * 0.5 + dx, top ? px.y - dy : px.y + px.h + dy, rr, 0, Math.PI * 2)
            ctx.fillStyle = '#fff'
            ctx.fill()
            ctx.stroke()
          }
        }
      }
      ctx.font = `${b.bold ? 700 : 500} ${b.fontSize}px ${font}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const y0 = px.y + px.h / 2 - ((lb.lines.length - 1) * lb.lh) / 2
      lb.lines.forEach((l, i) => {
        const y = y0 + i * lb.lh
        if (b.shape === 'sfx') {
          ctx.lineWidth = ts.strokeWidth * 2
          ctx.strokeStyle = ts.strokeColor
          ctx.strokeText(l, px.x + px.w / 2, y)
          ctx.fillStyle = '#fff'
        }
        else ctx.fillStyle = INK
        ctx.fillText(l, px.x + px.w / 2, y)
      })
    }
    ctx.restore()
    ctx.lineWidth = 4
    ctx.strokeStyle = INK
    ctx.strokeRect(r.x, r.y, r.w, r.h)
  }
  if (watermark) {
    ctx.font = '500 18px Pretendard Variable, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#71717A'
    ctx.fillText(watermark, 24, H - 4)
  }
  if (label) {
    ctx.font = '500 18px Pretendard Variable, sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#71717A'
    ctx.fillText(label, W - 24, H - 4)
  }
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

/** 컷에 고른 그림(후보 ID)들을 불러온다 */
export async function loadImages(storage: FirebaseStorage, db: Firestore, ws: string, episodeId: string, refs: CandidateRef[], into = new Map<string, ImageBitmap>()) {
  const todo = [...new Map(refs.map(r => [r.id, r])).values()].filter(r => !into.has(r.id))
  await Promise.all(todo.map(async r => into.set(r.id, await createImageBitmap(await getBlob(storageRef(storage, await resolveCandidatePath(db, ws, episodeId, r)))))))
  return into
}
