import type { Adjust } from '#shared/studio'
import type { Candidate, CandidateInput } from '#shared/illustrate'
import type { JobError, JobStatus } from '#shared/jobs'
import type { Crop, Cut } from '#shared/studio'
import type { Library } from '~/composables/useLibrary'
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { cutSize, panelPrompt, panelRefPaths, sceneRefCut } from '#shared/illustrate'
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
  const promptOf = (cut: Cut, opts: { extra?: string, leaveRoom?: boolean, sceneRef?: boolean }) => panelPrompt(cut.panel, charsOf(cut), styleOf(cut), opts)
  const sizeOf = (cut: Cut) => cutSize(s.cuts.value, cut, s.episode.value?.settings.aspect)

  /** 같은 장소·시간 컷에서 고른 그림 (의상·외모 맞추기용) */
  async function sceneRefPath(cut: Cut): Promise<string | null> {
    const ref = sceneRefCut(s.cuts.value, cut)
    if (!ref) return null
    const d = await getDoc(doc($firestore, 'workspaces', ws(), 'episodes', s.episode.value!.id, 'panels', ref.panel.id, 'candidates', ref.panel.selectedCandidateId!))
    const path = d.get('imagePath')
    return typeof path === 'string' ? path : null
  }

  /** ILL-01·02·20 */
  async function generate(list: Cut[], n: number, opts: { extra?: string, leaveRoom?: boolean, keyPrefix?: string }) {
    await Promise.all(list.map(async (cut) => {
      const st = styleOf(cut)
      const scene = await sceneRefPath(cut).catch(() => null)
      const input: CandidateInput = { scene: cut.panel.scene, characterIds: cut.panel.characterIds ?? [], styleId: st?.id ?? null, styleVersion: st?.version ?? null, extra: opts.extra ?? '' }
      return callFn($functions, 'startAiJob', {
        workspaceId: ws(),
        type: 'panel.image',
        target: { episodeId: s.episode.value!.id, panelId: cut.panel.id },
        params: { prompt: promptOf(cut, { extra: opts.extra, leaveRoom: opts.leaveRoom, sceneRef: !!scene }), n, ...(st?.negative ? { negative: st.negative } : {}), refPaths: [...(scene ? [scene] : []), ...(cut.panel.refImage ? [cut.panel.refImage] : []), ...panelRefPaths(charsOf(cut), st, cut.panel)].slice(0, 5), size: sizeOf(cut), input },
        idempotencyKey: opts.keyPrefix ? `${opts.keyPrefix}${cut.panel.id}`.slice(0, 64) : crypto.randomUUID(),
      })
    }))
  }
  /** ILL-21 변형 · ILL-22 부분 수정: 고른 후보를 첫 참조 이미지로 넘겨 같은 구도로 새 후보 */
  function edit(cut: Cut, base: Candidate, kind: 'variant' | 'inpaint', opts: { change: string, maskPath?: string }) {
    const st = styleOf(cut)
    const hint = kind === 'variant'
      ? `첫 번째 참조 이미지와 같은 구도·배경·인물 배치를 유지하고 표정과 세부만 조금 바꾼 변형. ${opts.change}`
      : `첫 번째 참조 이미지를 그대로 두고, 두 번째 참조 이미지(마스크)의 흰 부분만 다음 내용으로 다시 그려: ${opts.change}. 나머지는 바꾸지 않는다.`
    const input: CandidateInput = { scene: cut.panel.scene, characterIds: cut.panel.characterIds ?? [], styleId: st?.id ?? null, styleVersion: st?.version ?? null, extra: opts.change }
    return callFn($functions, 'startAiJob', {
      workspaceId: ws(),
      type: 'panel.image',
      target: { episodeId: s.episode.value!.id, panelId: cut.panel.id },
      params: { prompt: `${hint}\n\n${promptOf(cut, {})}`.slice(0, 4000), n: 1, ...(st?.negative ? { negative: st.negative } : {}), refPaths: [base.imagePath, ...(opts.maskPath ? [opts.maskPath] : []), ...panelRefPaths(charsOf(cut), st, cut.panel)].slice(0, 5), size: sizeOf(cut), input },
      idempotencyKey: crypto.randomUUID(),
    })
  }
  /** ILL-30 내 그림·사진을 후보로. 고른 그림이 없으면 바로 고른다 */
  async function uploadCandidate(cut: Cut, file: File) {
    await addCandidate(cut, await lib.upload('panels', cut.panel.id, file), 'upload')
  }
  /** ILL-31 다른 에피소드 후보·Assets 이미지를 후보로 */
  const importCandidate = (cut: Cut, imagePath: string) => addCandidate(cut, imagePath, 'import')
  async function addCandidate(cut: Cut, imagePath: string, source: 'upload' | 'import') {
    const panelPath = ['workspaces', ws(), 'episodes', s.episode.value!.id, 'panels', cut.panel.id] as const
    const ref = await addDoc(collection($firestore, ...panelPath, 'candidates'), { imagePath, width: 1080, height: 1350, source, jobId: '', input: null, hidden: false, favorite: false, workspaceId: ws(), episodeId: s.episode.value!.id, panelId: cut.panel.id, createdAt: serverTimestamp() })
    if (!cut.panel.selectedCandidateId) await updateDoc(doc($firestore, ...panelPath), { selectedCandidateId: ref.id, updatedAt: serverTimestamp() })
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
  const setAdjust = (id: string, adjust: Adjust | null) => s.updatePanel(id, { adjust })

  return { setFlag, edit, uploadCandidate, importCandidate, candidates, latest, style, charsOf, promptOf, generate, cancel, retry, choose, setCrop, setAdjust }
}
