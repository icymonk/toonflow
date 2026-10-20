import type { JobType } from '#shared/jobs'
import type { ModelsConfig } from '#shared/config'
import type { Series } from '#shared/episodes'
import type { JobStatus } from '#shared/jobs'
import type { Character, CharacterInput, Style } from '#shared/library'
import { addDoc, arrayRemove, arrayUnion, collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { deleteObject, ref as storageRef, uploadBytes } from 'firebase/storage'
import { defaultStyle, emptyAppearance } from '#shared/library'
import { estimateKrw } from '#shared/pricing'
import { callFn } from '~/lib/functions'

export type LibraryKind = 'characters' | 'styles'
export interface LibraryJob { status: JobStatus, providerResult?: string[], error?: { message: string } }

/** 캐릭터·그림체 (CHR·STL): 워크스페이스 공용 목록과 쓰기 */
export function useLibrary() {
  const { $firestore, $storage, $functions } = useNuxtApp()
  const auth = useAuthStore()
  const characters = ref<Character[]>([])
  const styles = ref<Style[]>([])
  const series = ref<Series[]>([])
  const models = ref<ModelsConfig | null>(null)
  const loaded = reactive({ characters: false, styles: false })
  const ws = () => auth.workspace!.id
  const col = (name: LibraryKind | 'series') => collection($firestore, 'workspaces', ws(), name)

  const stops: (() => void)[] = []
  watch(() => auth.workspace?.id, (id) => {
    stops.splice(0).forEach(s => s())
    loaded.characters = loaded.styles = false
    if (!id) return
    const live = <T>(snap: { docs: { id: string, data: () => unknown }[] }) => snap.docs.map(d => ({ id: d.id, ...(d.data() as object) }) as unknown as T & { deletedAt?: unknown }).filter(x => !x.deletedAt)
    stops.push(
      onSnapshot(query(col('characters'), orderBy('createdAt', 'desc')), (s) => {
        characters.value = live<Character>(s)
        loaded.characters = true
      }, () => (loaded.characters = true)),
      onSnapshot(query(col('styles'), orderBy('createdAt', 'desc')), (s) => {
        styles.value = live<Style>(s)
        loaded.styles = true
      }, () => (loaded.styles = true)),
      onSnapshot(col('series'), s => (series.value = live<Series>(s)), () => {}),
      onSnapshot(doc($firestore, 'config', 'models'), s => (models.value = (s.data() as ModelsConfig | undefined) ?? null), () => {}),
    )
  }, { immediate: true })
  onScopeDispose(() => stops.forEach(s => s()))

  const created = () => ({ archivedAt: null, deletedAt: null, createdBy: auth.user!.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  const createCharacter = (input: Partial<CharacterInput> & { name: string }) => addDoc(col('characters'), {
    aliases: [], intro: '', appearance: emptyAppearance(), appearanceText: '', episodeId: null, ...input, refImages: [], coverPath: null, ...created(),
  })
  const createStyle = () => addDoc(col('styles'), { ...defaultStyle(), refImages: [], version: 1, ...created() })
  const update = (kind: LibraryKind, id: string, patch: Record<string, unknown>) => updateDoc(doc(col(kind), id), { ...patch, updatedAt: serverTimestamp() })
  /** CHR-11: 휴지통으로 (쓰인 컷의 그림은 그대로) */
  const remove = (kind: LibraryKind, id: string) => update(kind, id, { deletedAt: serverTimestamp() })

  async function upload(kind: LibraryKind | 'panels', id: string, file: File) {
    const path = `workspaces/${ws()}/refs/${kind}/${id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
    await uploadBytes(storageRef($storage, path), file, { contentType: file.type })
    return path
  }
  const removeFile = (path: string) => (path.includes('/refs/') ? deleteObject(storageRef($storage, path)).catch(() => {}) : Promise.resolve())

  /** CHR-09: 작품 주요 캐릭터 */
  const setMain = (seriesId: string, characterId: string, on: boolean) =>
    updateDoc(doc(col('series'), seriesId), { mainCharacterIds: on ? arrayUnion(characterId) : arrayRemove(characterId), updatedAt: serverTimestamp() })
  /** 작품에서 쓰는 그림체 */
  const setSeriesStyle = (seriesId: string, styleId: string | null) => updateDoc(doc(col('series'), seriesId), { styleId, updatedAt: serverTimestamp() })

  /** CHR-04·STL-04 이미지 생성 (style.sample) */
  const generate = (target: { characterId: string } | { styleId: string }, params: Record<string, unknown>) =>
    callFn($functions, 'startAiJob', { workspaceId: ws(), type: 'style.sample', target, params, idempotencyKey: crypto.randomUUID() })
  const estimate = (images: number) => (models.value ? estimateKrw(models.value, models.value.defaults.image, 'style.sample', { images }) : 0)
  const estimateText = (type: JobType, inputChars: number) => (models.value ? estimateKrw(models.value, models.value.defaults.text, type, { inputChars }) : 0)

  /** CHR-08 등장 기록 */
  async function appearances(characterId: string) {
    const eps = await getDocs(collection($firestore, 'workspaces', ws(), 'episodes'))
    const out = await Promise.all(eps.docs.filter(e => !e.get('deletedAt')).map(async (e) => {
      const ps = await getDocs(query(collection($firestore, 'workspaces', ws(), 'episodes', e.id, 'panels'), where('characterIds', 'array-contains', characterId)))
      return { episodeId: e.id, title: String(e.get('title') ?? ''), panels: ps.size }
    }))
    return out.filter(x => x.panels > 0)
  }

  function watchJob(id: Ref<string | null>) {
    const job = ref<LibraryJob | null>(null)
    let stop: (() => void) | null = null
    watch(id, (j) => {
      stop?.()
      job.value = null
      if (j) stop = onSnapshot(doc($firestore, 'workspaces', ws(), 'aiJobs', j), s => (job.value = (s.data() as LibraryJob | undefined) ?? null), () => {})
    }, { immediate: true })
    onScopeDispose(() => stop?.())
    return job
  }

  return { characters, styles, series, loaded, createCharacter, createStyle, update, remove, upload, removeFile, setMain, setSeriesStyle, generate, estimate, estimateText, watchJob, appearances }
}
export type Library = ReturnType<typeof useLibrary>
