import type { Cut } from '#shared/studio'
import type { ClipSettings, VideoSettings } from '#shared/video'
import { deleteField, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { deleteObject, getBlob, getDownloadURL, ref as sref, uploadBytes } from 'firebase/storage'
import { AI_LABEL, exportName } from '#shared/render'
import { buildClips, clampMs, DEFAULT_VIDEO, REELS_MAX_MS, totalMs, VIDEO_SIZES } from '#shared/video'
import { download, loadFonts, loadImages } from '~/lib/export'
import { canExportMp4, encodeMp4 } from '~/lib/mp4'
import { frameRenderer } from '~/lib/video'
import { ko } from '~/locales/ko'

/** 영상 설정(meta/video)·타임라인·프레임 렌더러·배경음악·MP4 (PUB-30~38) */
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

  // PUB-36 배경음악: workspaces/{ws}/refs/music/{episodeId}/{file}, audio/* 20MB 미만
  const MUSIC_MAX = 20 * 1024 * 1024
  async function uploadMusic(f: File) {
    if (!f.type.startsWith('audio/')) throw new Error(ko.studio.video.musicNotAudio)
    if (f.size >= MUSIC_MAX) throw new Error(ko.studio.video.musicTooBig)
    const old = settings.value.musicPath
    const path = `workspaces/${auth.workspace!.id}/refs/music/${s.episode.value!.id}/${Date.now()}-${f.name.replace(/[^\w.-]/g, '_')}`
    await uploadBytes(sref($storage, path), f, { contentType: f.type })
    await save({ musicPath: path })
    if (old) await deleteObject(sref($storage, old)).catch(() => {})
  }
  async function removeMusic() {
    const old = settings.value.musicPath
    await save({ musicPath: null })
    if (old) await deleteObject(sref($storage, old)).catch(() => {})
  }
  const musicUrl = ref<string | null>(null)
  watch(() => settings.value.musicPath, async (p) => {
    musicUrl.value = null
    if (p) musicUrl.value = await getDownloadURL(sref($storage, p)).catch(() => null)
  }, { immediate: true })
  const musicName = computed(() => settings.value.musicPath?.split('/').pop()?.replace(/^\d+-/, '') ?? null)

  // PUB-38 MP4 내려받기
  const supported = ref<boolean | null>(null)
  watch(size, async v => (supported.value = await canExportMp4(v.w, v.h)), { immediate: true })
  const progress = ref<number | null>(null)
  let abort: AbortController | null = null
  async function exportMp4() {
    const ep = s.episode.value!
    abort = new AbortController()
    progress.value = 0
    try {
      await loadFonts(review.typeset.value)
      imgs.value = await loadImages($storage, auth.workspace!.id, s.cuts.value.map(c => c.panel.selectedCandidateId).filter((x): x is string => !!x), new Map(imgs.value))
      const m = settings.value
      const music = m.musicPath ? { blob: await getBlob(sref($storage, m.musicPath)), volume: m.musicVolume, fadeOutMs: m.musicFadeOutMs, loop: m.musicLoop } : null
      const out = await encodeMp4({ W: size.value.w, H: size.value.h, totalMs: total.value, draw: draw.value, music, onProgress: r => (progress.value = r), signal: abort.signal })
      download(out.blob, exportName(s.seriesName.value || ep.title, ep.number, 0, 'mp4').replace(/_00\.mp4$/, '_릴스.mp4'))
      return { music: !!music, audio: out.audio }
    }
    finally {
      progress.value = null
      abort = null
    }
  }
  const cancelExport = () => abort?.abort()

  return { settings, save, setClip, autoDuration, allDuration, clips, total, over, size, draw, uploadMusic, removeMusic, musicUrl, musicName, supported, progress, exportMp4, cancelExport }
}
