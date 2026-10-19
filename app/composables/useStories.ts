import type { CreateEpisodeInput, Episode, Series, SeriesInput } from '#shared/episodes'
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { callFn } from '~/lib/functions'

/** Stories (EPI-01·02·10~12·16): 작품·에피소드 실시간 목록과 쓰기 */
export function useStories() {
  const { $firestore, $functions } = useNuxtApp()
  const auth = useAuthStore()
  const series = ref<Series[]>([])
  const episodes = ref<Episode[]>([])
  const loading = ref(true)
  const col = (name: 'series' | 'episodes') => collection($firestore, 'workspaces', auth.workspace!.id, name)

  const stops: (() => void)[] = []
  watch(() => auth.workspace?.id, (wsId) => {
    stops.splice(0).forEach(s => s())
    if (!wsId) return
    loading.value = true
    stops.push(
      onSnapshot(query(col('series'), orderBy('createdAt', 'desc')), (snap) => {
        series.value = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Series).filter(s => !s.deletedAt)
      }, () => {}),
      onSnapshot(query(col('episodes'), orderBy('updatedAt', 'desc')), (snap) => {
        episodes.value = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Episode).filter(e => !e.deletedAt)
        loading.value = false
      }, () => (loading.value = false)),
    )
  }, { immediate: true })
  onScopeDispose(() => stops.forEach(s => s()))

  const ws = () => auth.workspace!

  const createSeries = (input: SeriesInput) => addDoc(col('series'), {
    ...input,
    aspect: ws().defaults.aspect,
    styleId: null,
    mainCharacterIds: [],
    coverPath: null,
    episodeCount: 0,
    archivedAt: null,
    deletedAt: null,
    createdBy: auth.user!.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  const createEpisode = (input: Omit<CreateEpisodeInput, 'workspaceId'>) =>
    callFn($functions, 'createEpisode', { ...input, workspaceId: ws().id })

  const updateEpisode = (id: string, patch: Partial<Pick<Episode, 'title' | 'number' | 'step' | 'status'>> & { archivedAt?: unknown }) =>
    updateDoc(doc(col('episodes'), id), { ...patch, updatedAt: serverTimestamp() })

  const duplicate = (episodeId: string, mode: 'structure' | 'full') => callFn($functions, 'duplicateEpisode', { workspaceId: ws().id, episodeId, mode })
  const updateSeries = (id: string, patch: { archivedAt: unknown }) => updateDoc(doc(col('series'), id), { ...patch, updatedAt: serverTimestamp() })

  const trash = (kind: 'episode' | 'series', id: string) => callFn($functions, 'deleteToTrash', { workspaceId: ws().id, kind, id })

  return { series, episodes, loading, createSeries, createEpisode, updateEpisode, updateSeries, duplicate, trash }
}
