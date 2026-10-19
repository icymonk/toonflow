import type { BubbleStyle, BubbleTemplate } from '#shared/render'
import { getAuth } from 'firebase/auth'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { bubbleStyle } from '#shared/render'

/** REV-07: 워크스페이스 공용 말풍선 템플릿 (Assets에서 정리) */
export function useBubbleTemplates() {
  const { $firestore } = useNuxtApp()
  const auth = useAuthStore()
  const templates = ref<BubbleTemplate[]>([])
  let stop: (() => void) | undefined
  watch(() => auth.workspace?.id, (w) => {
    stop?.()
    templates.value = []
    if (!w) return
    stop = onSnapshot(query(collection($firestore, 'workspaces', w, 'bubbleTemplates'), orderBy('createdAt', 'desc')), s => (templates.value = s.docs.map(d => ({ id: d.id, ...d.data() }) as BubbleTemplate)), () => {})
  }, { immediate: true })
  onScopeDispose(() => stop?.())
  const col = () => collection($firestore, 'workspaces', auth.workspace!.id, 'bubbleTemplates')
  const save = (name: string, b: BubbleStyle) => addDoc(col(), { name: name.trim().slice(0, 20), ...bubbleStyle(b), createdBy: getAuth().currentUser!.uid, createdAt: serverTimestamp() })
  const remove = (id: string) => deleteDoc(doc(col(), id))
  return { templates, save, remove }
}
