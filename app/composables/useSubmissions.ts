import type { Submission, SubmissionInput, SubmissionStatus } from '#shared/submissions'
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'

/** 제보함 (INB-01·20~22): 워크스페이스 제보 실시간 목록과 쓰기 */
export function useSubmissions() {
  const { $firestore } = useNuxtApp()
  const auth = useAuthStore()
  const list = ref<Submission[]>([])
  const loading = ref(true)
  const col = () => collection($firestore, 'workspaces', auth.workspace!.id, 'submissions')

  let stop: (() => void) | undefined
  watch(() => auth.workspace?.id, (wsId) => {
    stop?.()
    if (!wsId) return
    loading.value = true
    stop = onSnapshot(query(col(), orderBy('createdAt', 'desc')), (snap) => {
      list.value = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Submission)
      loading.value = false
    }, () => (loading.value = false))
  }, { immediate: true })
  onScopeDispose(() => stop?.())

  async function add(items: SubmissionInput[]) {
    const batch = writeBatch($firestore)
    for (const item of items) {
      batch.set(doc(col()), { ...item, starred: false, note: '', status: 'new', episodeIds: [], createdBy: auth.user!.uid, createdAt: serverTimestamp() })
    }
    await batch.commit()
  }

  const update = (id: string, patch: Partial<Pick<Submission, 'title' | 'body' | 'sourceNote' | 'tags' | 'starred' | 'note' | 'status'>>) =>
    updateDoc(doc(col(), id), patch)

  async function setStatus(ids: string[], status: SubmissionStatus) {
    const batch = writeBatch($firestore)
    ids.forEach(id => batch.update(doc(col(), id), { status }))
    await batch.commit()
  }

  return { list, loading, add, update, setStatus }
}
