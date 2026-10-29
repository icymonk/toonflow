import type { QuickAnswers } from '#shared/quick'
import type { Cut } from '#shared/studio'
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { toast } from 'vue-sonner'
import { clipMs, draftDirection, LINE_RULE, quickKey, quickStage, SHAPE_PROMPT, SHAPE_REQUEST } from '#shared/quick'
import { callFn } from '~/lib/functions'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

interface KeyJob { id: string, status: string, idempotencyKey: string, type: string, target?: { panelId?: string } }

/** QCK-21~25: 빠른 제작 진행. 단계는 에피소드 상태로 정하므로, 화면을 다시 열면 남은 단계부터 이어서 한다 */
export function useQuick(episodeId: Ref<string>) {
  const { $firestore, $functions } = useNuxtApp()
  const auth = useAuthStore()
  const s = useStudio(episodeId)
  const lib = useLibrary()
  const story = useStory(s.episode, computed(() => s.cuts.value.length > 0))
  const ill = useIllustrate(s, lib, ref(''))
  const review = useReview(s, computed(() => s.episode.value?.settings.aspect))
  const answers = ref<QuickAnswers | null>(null)
  const done = ref(false)
  const loaded = ref(false)
  const jobs = ref<KeyJob[]>([])
  const ws = () => auth.workspace!.id
  const metaRef = () => doc($firestore, 'workspaces', ws(), 'episodes', episodeId.value, 'meta', 'quick')

  const stops: (() => void)[] = []
  watch(() => [auth.workspace?.id, episodeId.value] as const, ([w, id]) => {
    stops.splice(0).forEach(f => f())
    answers.value = null
    done.value = false
    loaded.value = false
    jobs.value = []
    if (!w || !id) return
    stops.push(
      onSnapshot(metaRef(), (snap) => {
        answers.value = (snap.get('answers') as QuickAnswers | undefined) ?? null
        done.value = !!snap.get('done')
        loaded.value = true
      }, () => (loaded.value = true)),
      onSnapshot(query(collection($firestore, 'workspaces', w, 'aiJobs'), where('target.episodeId', '==', id)), (snap) => {
        jobs.value = snap.docs.map(d => ({ id: d.id, ...d.data() }) as KeyJob)
      }, () => {}),
    )
  }, { immediate: true })
  onScopeDispose(() => stops.forEach(f => f()))

  const byKey = computed(() => new Map(jobs.value.map(j => [j.idempotencyKey, j])))
  const drawn = computed(() => s.cuts.value.filter(c => c.panel.selectedCandidateId).length)
  const stage = computed(() => quickStage({
    hasStory: !!s.episode.value?.activeStoryVersionId,
    hasBoard: (s.episode.value?.pageOrder?.length ?? 0) > 0,
    cuts: s.cuts.value.length,
    drawn: drawn.value,
    done: done.value,
  }))
  const key = (step: string) => quickKey(episodeId.value, step)
  const imgKey = (c: Cut) => key(`img-${c.panel.id}`)
  /** 빠른 제작이 시작한 작업 중 실패한 것 (다시 시도) */
  const failed = computed(() => jobs.value.filter(j => j.status === 'failed' && j.idempotencyKey?.startsWith(key(''))))
  const paused = ref(false)
  const error = ref('')

  const inflight = new Set<string>()
  async function once(k: string, fn: () => Promise<unknown>) {
    if (inflight.has(k) || byKey.value.has(k)) return
    inflight.add(k)
    try {
      await fn()
    }
    catch (e) {
      error.value = errorMessage(e) ?? ko.errors.unknown
      paused.value = true
      inflight.delete(k)
    }
  }

  async function finish(a: QuickAnswers) {
    await review.place(s.cuts.value, false)
    const ms = clipMs(a, s.cuts.value.length)
    if (ms) {
      await setDoc(doc($firestore, 'workspaces', ws(), 'episodes', episodeId.value, 'meta', 'video'), {
        aspect: '9:16',
        clips: Object.fromEntries(s.cuts.value.map(c => [c.panel.id, { durationMs: ms }])),
        updatedAt: serverTimestamp(),
      }, { merge: true })
    }
    await s.updateEpisode({ step: 'review' })
    await setDoc(metaRef(), { done: true, updatedAt: serverTimestamp() }, { merge: true })
  }

  async function tick() {
    const ep = s.episode.value
    const a = answers.value
    if (!ep || !a || done.value || paused.value || failed.value.length || !auth.workspace) return
    const lines = { lineLength: a.lineLength }
    const request = [SHAPE_REQUEST[a.shape], ep.settings.extraRequest].filter(Boolean).join('\n')
    if (stage.value === 'story') {
      if (!story.material.value) return
      if (a.direction === 'verbatim') return once(key('verbatim'), () => story.verbatim())
      const dir = draftDirection(a.direction)
      return once(key('draft'), () => story.start('story.draft', { ...lines, ...(dir ? { direction: dir } : {}), extraRequest: request }, key('draft')))
    }
    if (stage.value === 'storyboard') {
      const v = story.active.value
      if (!v) return
      return once(key('split'), () => story.split(v, ep.settings.pageCount, { ...lines, extraRequest: request }, key('split')))
    }
    if (stage.value === 'images') {
      const todo = s.cuts.value.filter(c => !c.panel.selectedCandidateId && !byKey.value.has(imgKey(c)) && !inflight.has(imgKey(c)))
      if (!todo.length) return
      todo.forEach(c => inflight.add(imgKey(c)))
      try {
        await ill.generate(todo, 1, { extra: SHAPE_PROMPT[a.shape], keyPrefix: key('img-') })
      }
      catch (e) {
        error.value = errorMessage(e) ?? ko.errors.unknown
        paused.value = true
        todo.forEach(c => inflight.delete(imgKey(c)))
      }
      return
    }
    if (stage.value === 'bubbles') return once(key('finish'), () => finish(a))
  }
  watch(() => [stage.value, answers.value, story.material.value, story.active.value?.id, s.cuts.value.length, drawn.value, byKey.value.size, paused.value, failed.value.length] as const, () => void tick(), { immediate: true })

  /** 실패한 작업을 다시 시도하고 이어 간다 */
  async function resume() {
    error.value = ''
    try {
      await Promise.all(failed.value.map(j => callFn($functions, 'retryAiJob', { workspaceId: ws(), jobId: j.id })))
    }
    catch (e) {
      toast.error(errorMessage(e) ?? ko.errors.unknown)
    }
    paused.value = false
  }
  /** QCK-24 모두 취소 */
  async function cancelAll() {
    paused.value = true
    const active = jobs.value.filter(j => ['queued', 'running'].includes(j.status))
    await Promise.all(active.map(j => callFn($functions, 'cancelAiJob', { workspaceId: ws(), jobId: j.id }).catch(() => {})))
  }

  // QCK-30 컷 다시 그리기: 끝나면 새 그림을 고른다
  const redrawing = ref(new Map<string, string>())
  async function redraw(c: Cut) {
    const prefix = key(`re${Date.now().toString(36)}-`)
    redrawing.value = new Map(redrawing.value).set(c.panel.id, `${prefix}${c.panel.id}`.slice(0, 64))
    await ill.generate([c], 1, { extra: SHAPE_PROMPT[answers.value?.shape ?? 'human'], keyPrefix: prefix }).catch((e) => {
      redrawing.value.delete(c.panel.id)
      toast.error(errorMessage(e) ?? ko.errors.unknown)
    })
  }
  watch(jobs, () => {
    for (const [panelId, k] of redrawing.value) {
      const j = byKey.value.get(k)
      if (!j || ['queued', 'running'].includes(j.status)) continue
      const m = new Map(redrawing.value)
      m.delete(panelId)
      redrawing.value = m
      if (j.status === 'succeeded') void ill.choose(panelId, `${j.id}_0`)
      else toast.error(ko.quick.redrawFailed)
    }
  })

  const maxChars = computed(() => LINE_RULE[answers.value?.lineLength ?? 'long'].chars)
  return { s, lib, review, answers, loaded, stage, drawn, failed, paused, error, resume, cancelAll, redraw, redrawing, maxChars }
}
