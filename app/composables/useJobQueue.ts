import type { JobStatus, JobType } from '#shared/jobs'
import type { SocialPost } from '#shared/social'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { ACTIVE_STATUSES } from '#shared/jobs'

type Ts = { toMillis: () => number }
export interface QueueJob { id: string, type: JobType, status: JobStatus, target?: { episodeId?: string, panelId?: string }, error?: { retryable?: boolean }, createdAt?: Ts, startedAt?: Ts, finishedAt?: Ts }

/** AIU-01 대기열: AI 작업과 SNS 게시 작업을 최근 순으로 */
export function useJobQueue() {
  const { $firestore } = useNuxtApp()
  const auth = useAuthStore()
  const jobs = ref<QueueJob[]>([])
  const posts = ref<SocialPost[]>([])
  let stops: (() => void)[] = []
  watch(() => auth.workspace?.id, (w) => {
    stops.forEach(f => f())
    stops = []
    jobs.value = []
    posts.value = []
    if (!w) return
    stops.push(onSnapshot(query(collection($firestore, 'workspaces', w, 'aiJobs'), orderBy('createdAt', 'desc'), limit(40)), s => (jobs.value = s.docs.map(d => ({ id: d.id, ...d.data() }) as QueueJob)), () => {}))
    stops.push(onSnapshot(query(collection($firestore, 'workspaces', w, 'socialPosts'), orderBy('createdAt', 'desc'), limit(20)), s => (posts.value = s.docs.map(d => ({ id: d.id, ...d.data() }) as SocialPost)), () => {}))
  }, { immediate: true })
  onScopeDispose(() => stops.forEach(f => f()))
  const activeJobs = computed(() => jobs.value.filter(j => ACTIVE_STATUSES.includes(j.status)))
  const activePosts = computed(() => posts.value.filter(p => p.status === 'queued' || p.status === 'running'))
  const activeCount = computed(() => activeJobs.value.length + activePosts.value.length)
  return { jobs, posts, activeJobs, activePosts, activeCount }
}
