import type { JobStatus, JobType } from '#shared/jobs'
import { useLocalStorage } from '@vueuse/core'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'

export interface JobNote { id: string, type: JobType, status: JobStatus, target?: { episodeId?: string, panelId?: string }, finishedAt?: { toMillis: () => number } }

/** CMN-10 (1단계: 생성 완료·실패, 사용량 80%·100%) */
export function useNotifications() {
  const { $firestore } = useNuxtApp()
  const auth = useAuthStore()
  const jobs = ref<JobNote[]>([])
  const seen = useLocalStorage('toonflow:notesSeen', 0)
  let stop: (() => void) | undefined
  watch(() => auth.workspace?.id, (w) => {
    stop?.()
    jobs.value = []
    if (!w) return
    stop = onSnapshot(query(collection($firestore, 'workspaces', w, 'aiJobs'), orderBy('createdAt', 'desc'), limit(30)), (snap) => {
      jobs.value = snap.docs.map(d => ({ id: d.id, ...d.data() }) as JobNote).filter(j => (j.status === 'succeeded' || j.status === 'failed') && j.finishedAt)
    }, () => {})
  }, { immediate: true })
  onScopeDispose(() => stop?.())
  const unread = computed(() => jobs.value.filter(j => j.finishedAt!.toMillis() > seen.value).length)
  const markSeen = () => (seen.value = Date.now())
  return { jobs, unread, markSeen }
}
