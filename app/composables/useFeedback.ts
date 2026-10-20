import type { Feedback, FeedbackKind, FeedbackReply, FeedbackStatus } from '#shared/feedback'
import { useLocalStorage } from '@vueuse/core'
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { hasNewReply, lastActivity } from '#shared/feedback'

/** CMN-61·62 내가 보낸 피드백 (최근 활동 순)과 새 답변 수 */
export function useFeedback() {
  const { $firestore } = useNuxtApp()
  const auth = useAuthStore()
  const mine = ref<Feedback[]>([])
  const loaded = ref(false)
  const seen = useLocalStorage('toonflow:feedbackSeen', 0)
  let stop: (() => void) | undefined
  watch(() => auth.user?.uid, (uid) => {
    stop?.()
    mine.value = []
    loaded.value = false
    if (!uid) return
    stop = onSnapshot(query(collection($firestore, 'feedback'), where('uid', '==', uid)), (s) => {
      mine.value = s.docs.map(d => ({ id: d.id, ...d.data() }) as Feedback).sort((a, b) => lastActivity(b) - lastActivity(a))
      loaded.value = true
    }, () => (loaded.value = true))
  }, { immediate: true })
  onScopeDispose(() => stop?.())
  const unread = computed(() => mine.value.filter(f => hasNewReply(f, seen.value)).length)
  const markSeen = () => (seen.value = Date.now())
  return { mine, loaded, seen, unread, markSeen }
}

/** CMN-60 피드백 보내기. 보던 화면 주소를 같이 남긴다 */
export function useFeedbackSend() {
  const { $firestore } = useNuxtApp()
  const auth = useAuthStore()
  return (kind: FeedbackKind, text: string, path: string) => addDoc(collection($firestore, 'feedback'), {
    uid: auth.user!.uid,
    email: (auth.user!.email ?? '').slice(0, 200),
    name: (auth.profile?.displayName ?? '').slice(0, 60),
    workspaceId: auth.workspace?.id ?? null,
    kind,
    text: text.trim(),
    path: path.slice(0, 300),
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/** CMN-61·63 피드백 한 건의 답변·댓글. 운영자가 답하면 "답변함", 본인이 댓글을 달면 다시 "접수" */
export function useFeedbackThread(id: () => string | undefined) {
  const { $firestore } = useNuxtApp()
  const auth = useAuthStore()
  const replies = ref<FeedbackReply[]>([])
  let off: (() => void) | undefined
  watch(id, (v) => {
    off?.()
    replies.value = []
    if (!v) return
    off = onSnapshot(query(collection($firestore, 'feedback', v, 'replies'), orderBy('createdAt')), (s) => {
      replies.value = s.docs.map(d => ({ id: d.id, ...d.data() }) as FeedbackReply)
    }, () => {})
  }, { immediate: true })
  onScopeDispose(() => off?.())
  async function reply(feedbackId: string, text: string, by: 'user' | 'admin') {
    const b = writeBatch($firestore)
    b.set(doc(collection($firestore, 'feedback', feedbackId, 'replies')), { by, uid: auth.user!.uid, text: text.trim(), createdAt: serverTimestamp() })
    b.update(doc($firestore, 'feedback', feedbackId), by === 'admin'
      ? { status: 'answered', adminReplyAt: serverTimestamp(), updatedAt: serverTimestamp() }
      : { status: 'open', userReplyAt: serverTimestamp(), updatedAt: serverTimestamp() })
    await b.commit()
  }
  const setStatus = (feedbackId: string, status: FeedbackStatus) => updateDoc(doc($firestore, 'feedback', feedbackId), { status, updatedAt: serverTimestamp() })
  return { replies, reply, setStatus }
}
