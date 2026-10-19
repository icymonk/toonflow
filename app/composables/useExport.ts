import type { Cut } from '#shared/studio'
import { getBlob, ref as storageRef } from 'firebase/storage'
import { zipSync } from 'fflate'
import { candidatePath } from '#shared/illustrate'
import { AI_LABEL, exportName, layoutPage, splitBatches } from '#shared/render'
import { download, drawPage } from '~/lib/export'
import { ko } from '~/locales/ko'

/** Export: 장별 JPG/PNG, ZIP, 장 하나만, 장수 상한 나누기 (PUB-03~05·13) */
export function useExport(s: ReturnType<typeof useStudio>, review: ReturnType<typeof useReview>, pages: Ref<Cut[][]>) {
  const { $storage } = useNuxtApp()
  const auth = useAuthStore()
  const progress = ref<string | null>(null)
  const fmt = computed(() => (s.episode.value?.settings.format === 'png' ? 'png' : 'jpg'))
  const aiLabel = computed(() => s.episode.value?.settings.aiLabel !== false)

  async function render(idx: number[]) {
    const { w, h } = review.size.value
    const imgs = new Map<string, ImageBitmap>()
    const ids = [...new Set(idx.flatMap(i => pages.value[i] ?? []).map(c => c.panel.selectedCandidateId).filter((x): x is string => !!x))]
    await Promise.all(ids.map(async id => imgs.set(id, await createImageBitmap(await getBlob(storageRef($storage, candidatePath(auth.workspace!.id, id)))))))
    const ep = s.episode.value!
    const out: { name: string, blob: Blob }[] = []
    for (const [k, i] of idx.entries()) {
      progress.value = ko.studio.publish.progress(k + 1, idx.length)
      const label = aiLabel.value && i === pages.value.length - 1 ? AI_LABEL : null
      const blob = await drawPage(layoutPage(pages.value[i]!, w, h, review.typeset.value), w, h, review.typeset.value, imgs, label, fmt.value === 'png' ? 'image/png' : 'image/jpeg')
      out.push({ name: exportName(s.seriesName.value || ep.title, ep.number, i + 1, fmt.value), blob })
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
  return { progress, fmt, aiLabel, all, one }
}
