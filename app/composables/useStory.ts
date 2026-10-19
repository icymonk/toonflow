import type { Episode } from '#shared/episodes'
import type { JobType } from '#shared/jobs'
import type { StoryParams, StoryVersion } from '#shared/story'
import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { versionToText } from '#shared/story'
import { callFn } from '~/lib/functions'

/** Story 단계 (STO-01·02·10~14·20~22·24): 각색안 목록, 재료 썰, AI 작업 시작 */
export function useStory(episode: Ref<Episode | null>, hasCuts: Ref<boolean>) {
  const { $firestore, $functions } = useNuxtApp()
  const auth = useAuthStore()
  const versions = ref<StoryVersion[]>([])
  const sources = ref<{ id: string, title: string, body: string }[]>([])
  const ws = () => auth.workspace!.id
  const epRef = () => doc($firestore, 'workspaces', ws(), 'episodes', episode.value!.id)

  let stop: (() => void) | undefined
  watch(() => episode.value?.id, (id) => {
    stop?.()
    versions.value = []
    if (!id) return
    stop = onSnapshot(query(collection(epRef(), 'storyVersions'), orderBy('createdAt', 'asc')), s => (versions.value = s.docs.map(d => ({ id: d.id, ...d.data() }) as StoryVersion)))
  }, { immediate: true })
  onScopeDispose(() => stop?.())

  // STO-01·24 재료 썰 원문
  watch(() => episode.value?.submissionIds.join(','), async () => {
    const ids = episode.value?.submissionIds ?? []
    const snaps = await Promise.all(ids.map(id => getDoc(doc($firestore, 'workspaces', ws(), 'submissions', id))))
    sources.value = snaps.filter(s => s.exists()).map(s => ({ id: s.id, title: s.get('title') as string, body: s.get('body') as string }))
  }, { immediate: true })
  const material = computed(() => sources.value.map(s => s.body).join('\n\n---\n\n'))
  const active = computed(() => versions.value.find(v => v.id === episode.value?.activeStoryVersionId) ?? null)

  function start(type: JobType, extra: Partial<StoryParams> = {}) {
    const e = episode.value!
    const params: StoryParams = {
      material: material.value,
      tone: e.settings.tone,
      pageCount: e.settings.pageCount,
      narrator: e.settings.narrator,
      extraRequest: e.settings.extraRequest ?? '',
      ...extra,
    }
    return callFn($functions, 'startAiJob', { workspaceId: ws(), type, target: { episodeId: e.id }, params, idempotencyKey: crypto.randomUUID() })
  }
  const analyze = () => start('story.analyze')
  /** STO-11·12: n개 안을 따로 만든다. request가 있으면 이번에만 덧붙인다 */
  const draft = (n: number, request = '', basedOn?: StoryVersion) =>
    Promise.all(Array.from({ length: n }, () => start('story.draft', {
      ...(request ? { extraRequest: [episode.value!.settings.extraRequest, request].filter(Boolean).join('\n') } : {}),
      ...(basedOn ? { basedOn: basedOn.id } : {}),
    })))
  /** SBD-01·02 자동 콘티 / 다시 나누기 */
  const split = (v: StoryVersion, pageCount?: number) => start('storyboard.split', { versionId: v.id, draft: versionToText(v), ...(pageCount ? { pageCount } : {}) })
  const titles = (v: StoryVersion) => start('story.titles', { versionId: v.id, draft: versionToText(v) })

  const updateVersion = (id: string, patch: Partial<Pick<StoryVersion, 'logline' | 'scenes' | 'punchline'>>) =>
    updateDoc(doc(epRef(), 'storyVersions', id), { ...patch, editedAt: serverTimestamp() })

  /** STO-22: 콘티가 이미 있으면 Storyboard에 영향 받음 */
  const setActive = (id: string) =>
    updateDoc(epRef(), { activeStoryVersionId: id, ...(hasCuts.value ? { staleFrom: 'story' } : {}), updatedAt: serverTimestamp() })
  const keepStale = () => updateDoc(epRef(), { staleFrom: null, updatedAt: serverTimestamp() })

  const updateSettings = (patch: Partial<Episode['settings']>) =>
    updateDoc(epRef(), { ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [`settings.${k}`, v])), updatedAt: serverTimestamp() })

  return { versions, sources, material, active, analyze, draft, split, titles, updateVersion, setActive, keepStale, updateSettings }
}
