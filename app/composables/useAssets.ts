import type { Asset } from '#shared/assets'
import type { Candidate } from '#shared/illustrate'
import { getAuth } from 'firebase/auth'
import { collection, collectionGroup, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { deleteObject, getBlob, ref as sref, uploadBytes } from 'firebase/storage'
import { callFn } from '~/lib/functions'

export type GenImage = Candidate & { workspaceId: string, episodeId: string | null, panelId: string }

/** AST: 참고 자료(assets)와 워크스페이스 전체 생성 이미지(후보) */
export function useAssets() {
  const { $firestore, $storage, $functions } = useNuxtApp()
  const auth = useAuthStore()
  const ws = () => auth.workspace!.id
  const assets = ref<Asset[]>([])
  const generated = ref<GenImage[]>([])
  const stops: (() => void)[] = []
  watch(() => auth.workspace?.id, (w) => {
    stops.splice(0).forEach(f => f())
    assets.value = []
    generated.value = []
    if (!w) return
    stops.push(onSnapshot(query(collection($firestore, 'workspaces', w, 'assets'), orderBy('createdAt', 'desc')), s => (assets.value = s.docs.map(d => ({ id: d.id, ...d.data() }) as Asset)), () => {}))
    stops.push(onSnapshot(query(collectionGroup($firestore, 'candidates'), where('workspaceId', '==', w), orderBy('createdAt', 'desc'), limit(300)), s => (generated.value = s.docs.map(d => ({ id: d.id, ...d.data() }) as GenImage)), () => {}))
  }, { immediate: true })
  onScopeDispose(() => stops.forEach(f => f()))

  async function upload(files: File[], tags: string[]) {
    for (const f of files) {
      const ref = doc(collection($firestore, 'workspaces', ws(), 'assets'))
      const path = `workspaces/${ws()}/refs/assets/${ref.id}/${Date.now()}-${f.name.replace(/[^\w.-]/g, '_')}`
      await uploadBytes(sref($storage, path), f, { contentType: f.type })
      await setDoc(ref, { path, name: f.name.slice(0, 100), size: f.size, tags, createdBy: getAuth().currentUser!.uid, createdAt: serverTimestamp() })
    }
  }
  const setTags = (id: string, tags: string[]) => updateDoc(doc($firestore, 'workspaces', ws(), 'assets', id), { tags })
  async function remove(a: Asset) {
    await deleteDoc(doc($firestore, 'workspaces', ws(), 'assets', a.id))
    await deleteObject(sref($storage, a.path)).catch(() => {})
  }
  const blob = (path: string) => getBlob(sref($storage, path))
  const cleanup = (days: number) => callFn($functions, 'cleanupCandidates', { workspaceId: ws(), olderThanDays: days })
  const usage = () => callFn($functions, 'storageUsage', { workspaceId: ws() })
  return { assets, generated, upload, setTags, remove, blob, cleanup, usage }
}
