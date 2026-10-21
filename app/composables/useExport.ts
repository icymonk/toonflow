import type { Cut } from '#shared/studio'
import type { DesignInfo, PageDesign } from '#shared/pagedesign'
import { ref as sref, uploadBytes } from 'firebase/storage'
import { zipSync } from 'fflate'
import type { SocialPlatform } from '#shared/social'
import { IG_CAPTION_MAX } from '#shared/instagram'
import { layoutDesign } from '#shared/pagedesign'
import { exportName, layoutPage, splitBatches } from '#shared/render'
import { selectedRefs } from '~/lib/candidates'
import { download, drawDesignPage, drawPage, loadImages, loadPaths } from '~/lib/export'
import { callFn } from '~/lib/functions'
import { ko } from '~/locales/ko'

/** 출력할 장: 컷이 있는 장, 표지·끝장(PUB-15·16) */
export type ExportSlot = { kind: 'cuts', cuts: Cut[] } | { kind: 'design', design: PageDesign }

/** Export: 장별 JPG/PNG, ZIP, 장 하나만, 장수 상한 나누기 (PUB-03~05·13) */
/** lastLabel: 마지막 장 아래 문구 (AI 생성 표기·제보자 크레딧, PUB-12·13) */
export function useExport(s: ReturnType<typeof useStudio>, review: ReturnType<typeof useReview>, pages: Ref<ExportSlot[]>, lastLabel: Ref<string | null>, info: Ref<DesignInfo>) {
  const { $firestore, $functions, $storage } = useNuxtApp()
  const auth = useAuthStore()
  const progress = ref<string | null>(null)
  const fmt = computed(() => (s.episode.value?.settings.format === 'png' ? 'png' : 'jpg'))
  const aiLabel = computed(() => s.episode.value?.settings.aiLabel !== false)

  async function render(idx: number[], format: 'jpg' | 'png' = fmt.value) {
    const { w, h } = review.size.value
    const slots = idx.map(i => pages.value[i]!)
    const imgs = await loadImages($storage, $firestore, auth.workspace!.id, s.episode.value!.id, selectedRefs(slots.flatMap(sl => (sl.kind === 'cuts' ? sl.cuts : []))))
    const bgs = await loadPaths($storage, slots.flatMap(sl => (sl.kind === 'design' && sl.design.imagePath ? [sl.design.imagePath] : [])))
    const ep = s.episode.value!
    const ts = review.typeset.value
    const wm = s.series.value?.watermark?.trim() || null
    const type = format === 'png' ? 'image/png' : 'image/jpeg'
    const scale = ep.settings.hiRes ? 2 : 1
    const out: { name: string, blob: Blob }[] = []
    for (const [k, i] of idx.entries()) {
      progress.value = ko.studio.publish.progress(k + 1, idx.length)
      const label = i === pages.value.length - 1 ? lastLabel.value : null
      const sl = slots[k]!
      const blob = sl.kind === 'cuts'
        ? await drawPage(layoutPage(sl.cuts, w, h, ts), w, h, ts, imgs, label, wm, type, scale)
        : await drawDesignPage(layoutDesign(sl.design, info.value, w, h), sl.design, w, h, ts, (sl.design.imagePath && bgs.get(sl.design.imagePath)) || null, label, wm, type, scale)
      out.push({ name: exportName(s.seriesName.value || ep.title, ep.number, i + 1, format), blob })
    }
    return out
  }
  async function all() {
    try {
      const batches = splitBatches(pages.value.map((_, i) => i))
      for (const [k, batch] of batches.entries()) {
        const files = await render(batch)
        const zip = zipSync(Object.fromEntries(await Promise.all(files.map(async f => [f.name, [new Uint8Array(await f.blob.arrayBuffer()), { level: 0 }] as [Uint8Array, { level: 0 }]]))))
        const base = files[0]!.name.replace(/_\d+\.\w+$/, '')
        download(new Blob([zip as BlobPart], { type: 'application/zip' }), batches.length > 1 ? `${base}_${k + 1}.zip` : `${base}.zip`)
      }
    }
    finally { progress.value = null }
  }
  async function one(i: number) {
    try {
      const [f] = await render([i])
      download(f!.blob, f!.name)
    }
    finally { progress.value = null }
  }
  /** PUB-24·25: 모든 장을 JPG로 한 번 그리고, 게시할 곳마다 올려서 접수한다. 진행·결과는 socialPosts와 에피소드 instagramPost·threadsPost로 */
  async function social(targets: { platform: SocialPlatform, caption: string }[]) {
    try {
      const ws = auth.workspace!.id
      const ep = s.episode.value!.id
      const files = await render(pages.value.map((_, i) => i), 'jpg')
      for (const tg of targets) {
        const batch = `${Date.now()}-${tg.platform}`
        const paths: string[] = []
        for (const [k, f] of files.entries()) {
          progress.value = ko.studio.publish.igUploading(k + 1, files.length)
          const path = `workspaces/${ws}/exports/${ep}/${batch}/${String(k + 1).padStart(2, '0')}.jpg`
          await uploadBytes(sref($storage, path), f.blob, { contentType: 'image/jpeg' })
          paths.push(path)
        }
        await callFn($functions, tg.platform === 'instagram' ? 'publishInstagram' : 'publishThreads', { workspaceId: ws, episodeId: ep, paths, caption: tg.caption.slice(0, IG_CAPTION_MAX) })
      }
    }
    finally { progress.value = null }
  }
  return { progress, fmt, aiLabel, all, one, social }
}
