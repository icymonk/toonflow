import type { Cut } from '#shared/studio'
import type { ClipSettings, VideoSettings } from '#shared/video'
import { deleteField, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { AI_LABEL } from '#shared/render'
import { buildClips, clampMs, DEFAULT_VIDEO, REELS_MAX_MS, totalMs, VIDEO_SIZES } from '#shared/video'
import { loadImages } from '~/lib/export'
import { frameRenderer } from '~/lib/video'

/** 영상 설정(meta/video)·타임라인·프레임 렌더러 (PUB-30~35·37) */
export function useVideo(s: ReturnType<typeof useStudio>, review: ReturnType<typeof useReview>) {
  const { $firestore, $storage } = useNuxtApp()
  const auth = useAuthStore()
  const settings = ref<VideoSettings>({ ...DEFAULT_VIDEO })
  const vRef = () => doc($firestore, 'workspaces', auth.workspace!.id, 'episodes', s.episode.value!.id, 'meta', 'video')
  let stop: (() => void) | undefined
  watch(() => [auth.workspace?.id, s.episode.value?.id] as const, ([w, ep]) => {
    stop?.()
    settings.value = { ...DEFAULT_VIDEO }
    if (!w || !ep) return
    stop = onSnapshot(vRef(), snap => (settings.value = { ...DEFAULT_VIDEO, ...(snap.data() as Partial<VideoSettings> | undefined) }), () => {})
  }, { immediate: true })
  onScopeDispose(() => stop?.())

  const save = (patch: Partial<Omit<VideoSettings, 'clips'>>) => setDoc(vRef(), { ...patch, updatedAt: serverTimestamp() }, { merge: true })
  const setClip = (id: string, patch: Partial<ClipSettings>) => setDoc(vRef(), { clips: { [id]: { ...patch, ...(patch.durationMs ? { durationMs: clampMs(patch.durationMs) } : {}) } }, updatedAt: serverTimestamp() }, { merge: true })
  const autoDuration = (id: string) => setDoc(vRef(), { clips: { [id]: { durationMs: deleteField() } }, updatedAt: serverTimestamp() }, { merge: true })
  const allDuration = (ms: number) => setDoc(vRef(), { clips: Object.fromEntries(clips.value.map(c => [c.id, { durationMs: clampMs(ms) }])), updatedAt: serverTimestamp() }, { merge: true })

  const clips = computed(() => buildClips(s.cuts.value, settings.value))
  const total = computed(() => totalMs(clips.value))
  const over = computed(() => total.value > REELS_MAX_MS)
  const size = computed(() => VIDEO_SIZES[settings.value.aspect] ?? VIDEO_SIZES['9:16'])
  const pages = computed(() => {
    const m = new Map<string, Cut[]>()
    for (const c of s.cuts.value) m.set(c.page.id, [...(m.get(c.page.id) ?? []), c])
    return m
  })
  const imgs = shallowRef(new Map<string, ImageBitmap>())
  watch(() => s.cuts.value.map(c => c.panel.selectedCandidateId).filter((x): x is string => !!x).join(), async (ids) => {
    if (!ids || !auth.workspace) return
    const m = new Map(imgs.value)
    await loadImages($storage, auth.workspace.id, ids.split(','), m).catch(() => {})
    imgs.value = m
  }, { immediate: true })
  const draw = computed(() => frameRenderer({
    clips: clips.value,
    pages: pages.value,
    W: size.value.w,
    H: size.value.h,
    page: review.size.value,
    ts: review.typeset.value,
    imgs: imgs.value,
    label: s.episode.value?.settings.aiLabel !== false ? AI_LABEL : null,
    watermark: s.series.value?.watermark?.trim() || null,
  }))
  return { settings, save, setClip, autoDuration, allDuration, clips, total, over, size, draw }
}
