import type { Candidate, CandidateInput } from '#shared/illustrate'
import type { JobError, JobStatus } from '#shared/jobs'
import type { Crop, Cut } from '#shared/studio'
import type { Library } from '~/composables/useLibrary'
import { collection, onSnapshot, orderBy, query, where, updateDoc, doc } from 'firebase/firestore'
import { panelPrompt, panelRefPaths } from '#shared/illustrate'
import { callFn } from '~/lib/functions'

export interface PanelJob { id: string, status: JobStatus, error?: JobError, createdAt?: { toMillis: () => number } | null, target: { panelId?: string } }

/** Illustrate: 선택한 컷의 후보, 컷별 최근 생성 작업, 생성·취소·다시 시도·선택·자르기 */
export function useIllustrate(s: ReturnType<typeof useStudio>, lib: Library, panelId: Ref<string>) {
  const { $firestore, $functions } = useNuxtApp()
  const auth = useAuthStore()
  const ws = () => auth.workspace!.id
  const candidates = ref<Candidate[]>([])
  const latest = ref(new Map<string, PanelJob>())
  let stopC: (() => void) | undefined
  let stopJ: (() => void) | undefined

  watch(() => [auth.workspace?.id, s.episode.value?.id, panelId.value] as const, ([w, ep, pid]) => {
    stopC?.()
    candidates.value = []
    if (!w || !ep || !pid) return
    stopC = onSnapshot(
      query(collection($firestore, 'workspaces', w, 'episodes', ep, 'panels', pid, 'candidates'), orderBy('createdAt', 'desc')),
      snap => (candidates.value = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Candidate)),
      () => {},
    )
  }, { immediate: true })

  // ILL-05·40: 컷마다 가장 최근 작업
  watch(() => [auth.workspace?.id, s.episode.value?.id] as const, ([w, ep]) => {
    stopJ?.()
    latest.value = new Map()
    if (!w || !ep) return
    stopJ = onSnapshot(
      query(collection($firestore, 'workspaces', w, 'aiJobs'), where('target.episodeId', '==', ep), where('type', '==', 'panel.image')),
      (snap) => {
        const m = new Map<string, PanelJob>()
        const at = (j?: PanelJob) => j?.createdAt?.toMillis() ?? Number.POSITIVE_INFINITY
        for (const d of snap.docs) {
          const j = { id: d.id, ...d.data() } as PanelJob
          const pid = j.target?.panelId
          if (pid && (!m.has(pid) || at(j) >= at(m.get(pid)))) m.set(pid, j)
        }
        latest.value = m
      },
      () => {},
    )
  }, { immediate: true })
  onScopeDispose(() => {
    stopC?.()
    stopJ?.()
  })

  const style = computed(() => {
    const ep = s.episode.value
    const id = ep?.settings.styleId ?? lib.series.value.find(x => x.id === ep?.seriesId)?.styleId
    return lib.styles.value.find(x => x.id === id) ?? null
  })
  const charsOf = (cut: Cut) => lib.characters.value.filter(c => cut.panel.characterIds?.includes(c.id))
  const styleOf = (cut: Cut) => (cut.panel.styleId && lib.styles.value.find(x => x.id === cut.panel.styleId)) || style.value
  const promptOf = (cut: Cut, opts: { extra?: string, leaveRoom?: boolean }) => panelPrompt(cut.panel, charsOf(cut), styleOf(cut), opts)

  /** ILL-01·02·20 */
  async function generate(list: Cut[], n: number, opts: { extra?: string, leaveRoom?: boolean }) {
    await Promise.all(list.map((cut) => {
      const st = styleOf(cut)
      const input: CandidateInput = { scene: cut.panel.scene, characterIds: cut.panel.characterIds ?? [], styleId: st?.id ?? null, styleVersion: st?.version ?? null, extra: opts.extra ?? '' }
      return callFn($functions, 'startAiJob', {
        workspaceId: ws(),
        type: 'panel.image',
        target: { episodeId: s.episode.value!.id, panelId: cut.panel.id },
        params: { prompt: promptOf(cut, opts), n, ...(st?.negative ? { negative: st.negative } : {}), refPaths: [...(cut.panel.refImage ? [cut.panel.refImage] : []), ...panelRefPaths(charsOf(cut), st)].slice(0, 5), input },
        idempotencyKey: crypto.randomUUID(),
      })
    }))
  }
  /** ILL-14 */
  const setFlag = (panelId: string, id: string, patch: { favorite?: boolean, hidden?: boolean }) => {
    const c = candidates.value.find(x => x.id === id)
    return updateDoc(doc($firestore, 'workspaces', ws(), 'episodes', s.episode.value!.id, 'panels', panelId, 'candidates', id), { favorite: c?.favorite ?? false, hidden: c?.hidden ?? false, ...patch })
  }
  const cancel = (jobId: string) => callFn($functions, 'cancelAiJob', { workspaceId: ws(), jobId })
  const retry = (jobId: string) => callFn($functions, 'retryAiJob', { workspaceId: ws(), jobId })
  /** ILL-11: 이전 선택은 후보로 남는다 */
  const choose = (id: string, candidateId: string) => s.updatePanel(id, { selectedCandidateId: candidateId, staleFrom: null, crop: null })
  const setCrop = (id: string, crop: Crop | null) => s.updatePanel(id, { crop })

  return { setFlag, candidates, latest, style, charsOf, promptOf, generate, cancel, retry, choose, setCrop }
}
