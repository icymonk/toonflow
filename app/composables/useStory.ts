import type { Episode } from '#shared/episodes'
import type { JobType } from '#shared/jobs'
import type { RewriteMode, StoryParams, StoryVersion, SuggestField } from '#shared/story'
import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { toast } from 'vue-sonner'
import { DRAFT_DIRECTIONS, parseJson, rewriteSchema, suggestSchema, textToDialogues, versionToText } from '#shared/story'
import { ko } from '~/locales/ko'
import { callFn } from '~/lib/functions'

/** Story 단계 (STO-01·02·10~14·20~22·24): 각색안 목록, 재료 썰, AI 작업 시작 */
export function useStory(episode: Ref<Episode | null>, hasCuts: Ref<boolean>, context: Ref<string> = ref('')) {
  const { $firestore, $functions } = useNuxtApp()
  const auth = useAuthStore()
  const versions = ref<StoryVersion[]>([])
  const sources = ref<{ id: string, title: string, body: string, maskedBody?: string | null, status?: string, credit?: string, withdrawn?: unknown }[]>([])
  const ws = () => auth.workspace!.id
  const epRef = () => doc($firestore, 'workspaces', ws(), 'episodes', episode.value!.id)

  let stop: (() => void) | undefined
  watch(() => episode.value?.id, (id) => {
    stop?.()
    versions.value = []
    if (!id) return
    stop = onSnapshot(query(collection(epRef(), 'storyVersions'), orderBy('createdAt', 'asc')), s => (versions.value = s.docs.map(d => ({ id: d.id, ...d.data() }) as StoryVersion)))
  }, { immediate: true })
  onScopeDispose(() => stop?.())

  // STO-01·24 재료 썰 원문
  watch(() => episode.value?.submissionIds.join(','), async () => {
    const ids = episode.value?.submissionIds ?? []
    const snaps = await Promise.all(ids.map(id => getDoc(doc($firestore, 'workspaces', ws(), 'submissions', id))))
    sources.value = snaps.filter(s => s.exists()).map(s => ({ id: s.id, title: s.get('title') as string, body: s.get('body') as string, maskedBody: s.get('maskedBody') as string | null | undefined, status: s.get('status') as string, credit: s.get('credit') as string | undefined, withdrawn: s.get('withdrawn') }))
  }, { immediate: true })
  // STO-16: 여러 화로 나눴으면 이 화 부분만
  const material = computed(() => episode.value?.materialPart?.text || sources.value.map(s => s.maskedBody || s.body).join('\n\n---\n\n'))
  const active = computed(() => versions.value.find(v => v.id === episode.value?.activeStoryVersionId) ?? null)

  function start(type: JobType, extra: Partial<StoryParams> = {}) {
    const e = episode.value!
    const params: StoryParams = {
      material: material.value,
      tone: e.settings.tone,
      pageCount: e.settings.pageCount,
      narrator: e.settings.narrator,
      extraRequest: e.settings.extraRequest ?? '',
      ...(context.value ? { context: context.value } : {}),
      ...(e.materialPart ? { part: { index: e.materialPart.index, total: e.materialPart.total } } : {}),
      ...extra,
    }
    return callFn($functions, 'startAiJob', { workspaceId: ws(), type, target: { episodeId: e.id }, params, idempotencyKey: crypto.randomUUID() })
  }
  const analyze = () => start('story.analyze')
  /** STO-16: 화 나누기 제안 (count가 없으면 AI가 화 수를 정함) */
  const planEpisodes = (count?: number) => start('story.episodes', count ? { partCount: count } : {})
  const splitEpisodes = (parts: { title: string, text: string }[]) => callFn($functions, 'splitEpisodes', { workspaceId: ws(), episodeId: episode.value!.id, parts })
  /** STO-11·12: n개 안을 따로 만든다. request가 있으면 이번에만 덧붙인다 */
  const draft = (n: number, request = '', basedOn?: StoryVersion) =>
    Promise.all(Array.from({ length: n }, (_, i) => start('story.draft', {
      ...(n > 1 ? { direction: DRAFT_DIRECTIONS[i % DRAFT_DIRECTIONS.length] } : {}),
      ...(request ? { extraRequest: [episode.value!.settings.extraRequest, request].filter(Boolean).join('\n') } : {}),
      ...(basedOn ? { basedOn: basedOn.id } : {}),
    })))
  /** SBD-01·02 자동 콘티 / 다시 나누기 */
  const split = (v: StoryVersion, pageCount?: number) => start('storyboard.split', { versionId: v.id, draft: versionToText(v), ...(pageCount ? { pageCount } : {}) })
  const titles = (v: StoryVersion) => start('story.titles', { versionId: v.id, draft: versionToText(v) })
  /** STO-13: 장면 본문이나 대사만 다시 쓰고, 끝나면 그 자리에 넣는다 */
  const rewriting = ref<{ jobId: string, versionId?: string, sceneId?: string, field?: 'beats' | 'dialogues', panelId?: string } | null>(null)
  const rewriteRev = ref(0)
  async function rewrite(v: StoryVersion, sceneId: string, field: 'beats' | 'dialogues', text: string, mode: RewriteMode, tone = '') {
    const out = await start('story.rewrite', { versionId: v.id, draft: versionToText(v), rewrite: { mode, text, tone } })
    rewriting.value = { jobId: out.jobId, versionId: v.id, sceneId, field }
  }
  /** SBD-14 장면 설명을 그림 생성에 맞게 */
  async function refine(panelId: string, scene: string) {
    const v = active.value
    const out = await start('story.rewrite', { ...(v ? { draft: versionToText(v) } : {}), rewrite: { mode: 'refine', text: scene, tone: '' } })
    rewriting.value = { jobId: out.jobId, panelId }
  }
  let stopRw: (() => void) | undefined
  watch(rewriting, (rw) => {
    stopRw?.()
    if (!rw) return
    stopRw = onSnapshot(doc($firestore, 'workspaces', ws(), 'aiJobs', rw.jobId), async (snap) => {
      const st = snap.get('status')
      if (st === 'failed' || st === 'canceled') {
        rewriting.value = null
        toast.error(ko.studio.story.rewriteFailed)
        return
      }
      if (st !== 'succeeded') return
      const out = parseJson(rewriteSchema, String(snap.get('providerResult') ?? ''))
      const v = versions.value.find(x => x.id === rw.versionId)
      rewriting.value = null
      if (out && rw.panelId) {
        await updateDoc(doc(epRef(), 'panels', rw.panelId), { scene: out.text.slice(0, 2000), updatedAt: serverTimestamp() })
        toast.success(ko.studio.story.rewritten)
        return
      }
      if (!out || !v) return
      await updateVersion(v.id, { scenes: v.scenes.map(sc => sc.id !== rw.sceneId ? sc : { ...sc, ...(rw.field === 'beats' ? { beats: out.text } : { dialogues: textToDialogues(out.text) }) }) })
      rewriteRev.value++
      toast.success(ko.studio.story.rewritten)
    }, () => {})
  })
  onScopeDispose(() => stopRw?.())
  /** 추천 입력: 각색안 칸 하나(key)에 AI 후보 3개. 고르면 칸에 넣고 직접 고칠 수 있다 */
  const suggesting = ref<{ jobId: string, key: string } | null>(null)
  const suggestions = ref<Record<string, string[]>>({})
  async function suggest(v: StoryVersion, key: string, field: SuggestField, text: string, scene = '') {
    const out = await start('story.suggest', { versionId: v.id, draft: versionToText(v), suggest: { field, text, ...(scene ? { scene } : {}) } })
    suggesting.value = { jobId: out.jobId, key }
  }
  let stopSg: (() => void) | undefined
  watch(suggesting, (sg) => {
    stopSg?.()
    if (!sg) return
    stopSg = onSnapshot(doc($firestore, 'workspaces', ws(), 'aiJobs', sg.jobId), (snap) => {
      const st = snap.get('status')
      if (st !== 'succeeded' && st !== 'failed' && st !== 'canceled') return
      const out = st === 'succeeded' ? parseJson(suggestSchema, String(snap.get('providerResult') ?? '')) : null
      suggesting.value = null
      if (!out) return void toast.error(ko.studio.story.suggestFailed)
      suggestions.value = { ...suggestions.value, [sg.key]: out.options }
    }, () => {})
  })
  watch(() => episode.value?.id, () => (suggestions.value = {}))
  onScopeDispose(() => stopSg?.())
  /** PUB-10 */
  const caption = (v: StoryVersion) => start('publish.caption', { versionId: v.id, draft: versionToText(v) })

  const updateVersion = (id: string, patch: Partial<Pick<StoryVersion, 'logline' | 'scenes' | 'punchline'>>) =>
    updateDoc(doc(epRef(), 'storyVersions', id), { ...patch, editedAt: serverTimestamp() })

  /** STO-22: 콘티가 이미 있으면 Storyboard에 영향 받음 */
  const setActive = (id: string) =>
    updateDoc(epRef(), { activeStoryVersionId: id, ...(hasCuts.value ? { staleFrom: 'story' } : {}), updatedAt: serverTimestamp() })
  const keepStale = () => updateDoc(epRef(), { staleFrom: null, updatedAt: serverTimestamp() })

  const updateSettings = (patch: Partial<Episode['settings']>) =>
    updateDoc(epRef(), { ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [`settings.${k}`, v])), updatedAt: serverTimestamp() })

  return { versions, sources, material, active, analyze, planEpisodes, splitEpisodes, draft, split, titles, caption, rewrite, refine, rewriting, rewriteRev, suggest, suggesting, suggestions, updateVersion, setActive, keepStale, updateSettings }
}
