import type { DesignKind, PageDesign } from '#shared/pagedesign'
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { deleteObject, ref as storageRef, uploadBytes } from 'firebase/storage'
import { defaultDesign } from '#shared/pagedesign'

/** PUB-15~17: 워크스페이스 공용 표지·끝장 디자인 */
export function usePageDesigns() {
  const { $firestore, $storage } = useNuxtApp()
  const auth = useAuthStore()
  const list = ref<PageDesign[]>([])
  const loaded = ref(false)
  const col = () => collection($firestore, 'workspaces', auth.workspace!.id, 'pageDesigns')
  let stop: (() => void) | undefined
  watch(() => auth.workspace?.id, (w) => {
    stop?.()
    list.value = []
    loaded.value = false
    if (!w) return
    stop = onSnapshot(query(col(), orderBy('createdAt', 'desc')), (s) => {
      list.value = s.docs.map(d => ({ id: d.id, ...d.data() }) as PageDesign).filter(d => !d.deletedAt)
      loaded.value = true
    }, () => (loaded.value = true))
  }, { immediate: true })
  onScopeDispose(() => stop?.())

  const create = (kind: DesignKind, seriesId: string | null) => addDoc(col(), {
    ...defaultDesign(kind), kind, imagePath: null, seriesId, archivedAt: null, deletedAt: null,
    createdBy: auth.user!.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
  const update = (id: string, patch: Record<string, unknown>) => updateDoc(doc(col(), id), { ...patch, updatedAt: serverTimestamp() })
  const remove = (id: string) => update(id, { deletedAt: serverTimestamp() })
  async function upload(id: string, file: File) {
    const path = `workspaces/${auth.workspace!.id}/refs/pageDesigns/${id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
    await uploadBytes(storageRef($storage, path), file, { contentType: file.type })
    return path
  }
  const removeFile = (path: string) => deleteObject(storageRef($storage, path)).catch(() => {})
  /** 작품 기본 표지·끝장 */
  const setSeriesDefault = (seriesId: string, kind: DesignKind, id: string | null) =>
    updateDoc(doc($firestore, 'workspaces', auth.workspace!.id, 'series', seriesId), { [kind === 'cover' ? 'coverDesignId' : 'outroDesignId']: id, updatedAt: serverTimestamp() })
  return { list, loaded, create, update, remove, upload, removeFile, setSeriesDefault }
}
