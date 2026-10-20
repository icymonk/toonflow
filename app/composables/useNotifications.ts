import type { JobStatus, JobType } from '#shared/jobs'
import { useLocalStorage } from '@vueuse/core'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'

export interface WithdrawNote { id: string, published: boolean, at: { toMillis: () => number } }
export interface JobNote { id: string, type: JobType, status: JobStatus, target?: { episodeId?: string, panelId?: string }, finishedAt?: { toMillis: () => number } }

/** CMN-10·12 (생성 완료·실패, 사용량 80%·100%, 제보 동의 철회). 메일 알림은 발신 도메인이 생기면 (open-questions #23) */
export function useNotifications() {
  const { $firestore } = useNuxtApp()
  const auth = useAuthStore()
  const jobs = ref<JobNote[]>([])
  const withdrawals = ref<WithdrawNote[]>([])
  const seen = useLocalStorage('toonflow:notesSeen', 0)
  // CMN-11 받을 알림 종류 (이 브라우저에만 저장)
  const prefs = useLocalStorage('toonflow:notePrefs', { done: true, failed: true, usage: true, withdrawn: true, feedback: true }, { mergeDefaults: true })
  let stops: (() => void)[] = []
  watch(() => auth.workspace?.id, (w) => {
    stops.forEach(f => f())
    stops = []
    jobs.value = []
    withdrawals.value = []
    if (!w) return
    stops.push(onSnapshot(query(collection($firestore, 'workspaces', w, 'submissions'), orderBy('withdrawn.at', 'desc'), limit(10)), (snap) => {
      withdrawals.value = snap.docs.flatMap((d) => {
        const wd = d.get('withdrawn') as { at?: WithdrawNote['at'], published?: boolean } | undefined
        return wd?.at ? [{ id: d.id, published: wd.published === true, at: wd.at }] : []
      })
    }, () => {}))
    stops.push(onSnapshot(query(collection($firestore, 'workspaces', w, 'aiJobs'), orderBy('createdAt', 'desc'), limit(30)), (snap) => {
      jobs.value = snap.docs.map(d => ({ id: d.id, ...d.data() }) as JobNote).filter(j => (j.status === 'succeeded' || j.status === 'failed') && j.finishedAt)
    }, () => {}))
  }, { immediate: true })
  onScopeDispose(() => stops.forEach(f => f()))
  const shown = computed(() => jobs.value.filter(j => (j.status === 'failed' ? prefs.value.failed : prefs.value.done)))
  const shownWithdrawals = computed(() => (prefs.value.withdrawn ? withdrawals.value : []))
  const unread = computed(() => shown.value.filter(j => j.finishedAt!.toMillis() > seen.value).length
    + shownWithdrawals.value.filter(w => w.at.toMillis() > seen.value).length)
  const markSeen = () => (seen.value = Date.now())
  return { jobs, shown, withdrawals: shownWithdrawals, prefs, unread, markSeen }
}
