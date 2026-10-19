import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore'
import { useIntervalFn } from '@vueuse/core'

export interface Presence { id: string, name: string | null, photoURL: string | null, panelId: string | null, at: Timestamp | null }

const BEAT_MS = 30_000
const FRESH_MS = 75_000

/** STU-24: 같은 에피소드를 보는 다른 사람과 그 사람이 고른 컷 */
export function usePresence(episodeId: Ref<string>, panelId: Ref<string>) {
  const { $firestore } = useNuxtApp()
  const auth = useAuthStore()
  const all = ref<Presence[]>([])
  const now = ref(Date.now())
  useIntervalFn(() => (now.value = Date.now()), 15_000)
  const ws = () => auth.workspace?.id ?? ''

  const others = computed(() => all.value.filter(p => p.id !== auth.user?.uid && p.at && now.value - p.at.toMillis() < FRESH_MS))
  const samePanel = computed(() => others.value.filter(p => panelId.value && p.panelId === panelId.value))

  const me = () => (ws() && episodeId.value && auth.user ? doc($firestore, 'workspaces', ws(), 'episodes', episodeId.value, 'presence', auth.user.uid) : null)
  const beat = () => {
    const r = me()
    if (!r) return
    setDoc(r, { name: auth.user!.displayName ?? auth.user!.email ?? null, photoURL: auth.user!.photoURL ?? null, panelId: panelId.value || null, at: serverTimestamp() }).catch(() => {})
  }
  const leave = (ep: string) => {
    if (ws() && ep && auth.user) deleteDoc(doc($firestore, 'workspaces', ws(), 'episodes', ep, 'presence', auth.user.uid)).catch(() => {})
  }

  let unsub: (() => void) | null = null
  watch(episodeId, (ep, prev) => {
    unsub?.()
    unsub = null
    all.value = []
    if (prev) leave(prev)
    if (!ep || !ws()) return
    unsub = onSnapshot(collection($firestore, 'workspaces', ws(), 'episodes', ep, 'presence'), s => (all.value = s.docs.map(d => ({ id: d.id, ...d.data() }) as Presence)), () => {})
    beat()
  }, { immediate: true })
  watch(panelId, beat)
  useIntervalFn(() => document.visibilityState === 'visible' && beat(), BEAT_MS)
  onBeforeUnmount(() => {
    unsub?.()
    leave(episodeId.value)
  })

  return { others, samePanel }
}
