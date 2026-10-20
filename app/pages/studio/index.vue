<script setup lang="ts">
import type { AiCheckMode } from '#shared/aicheck'
import { AI_CHECK_MAX, AI_CHECK_MODES, IMAGE_CHARS } from '#shared/aicheck'
import { serverTimestamp } from 'firebase/firestore'
import type { Step } from '#shared/episodes'
import type { Cut, Panel, StaleFrom } from '#shared/studio'
import type { PanelJob } from '~/composables/useIllustrate'
import { ArrowDown, ArrowUp, Check, Copy, GripVertical, Sparkles, ChevronLeft, ChevronRight, Clapperboard, Eye, History, Loader2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus, Redo2, Trash2, Undo2, X } from '@lucide/vue'
import { onKeyStroke, useDebounceFn, useIntervalFn, useLocalStorage } from '@vueuse/core'
import { toast } from 'vue-sonner'
import { stageOf, STEPS } from '#shared/episodes'
import { bulkTargets } from '#shared/illustrate'
import { AI_LABEL, autoCheck } from '#shared/render'
import { creditLine } from '#shared/intake'
import { matchCharacters } from '#shared/library'
import { canEdit } from '#shared/roles'
import type { ReviewState } from '#shared/review'
import { composeCaption } from '#shared/publish'
import { storyContext } from '#shared/story'
import { checklist, reviewLeft } from '#shared/review'
import { firstUnmetBefore, remaining } from '#shared/studio'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

const t = ko.studio
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const edit = computed(() => canEdit(auth.role))
const episodeId = computed(() => String(route.query.episode ?? ''))
const s = useStudio(episodeId)
const { episode, cuts } = s
// STO-03: 작품 메모 + 주요·이번 화 캐릭터의 성격·말투
const storyCtx = computed(() => {
  const ids = new Set([...(s.series.value?.mainCharacterIds ?? []), ...(episode.value?.settings.characterIds ?? [])])
  return storyContext(s.series.value?.memo, lib.characters.value.filter(c => ids.has(c.id)))
})
const story = useStory(episode, computed(() => cuts.value.length > 0), storyCtx)
const lib = useLibrary()
const selectedPanelId = computed(() => String(route.query.panel ?? '') || cuts.value[0]?.panel.id || '')
const ill = useIllustrate(s, lib, selectedPanelId)
const presence = usePresence(episodeId, selectedPanelId)
const illN = useLocalStorage('toonflow:studio:candidates', 2)
const illBusy = computed(() => cuts.value.filter(c => s.busyPanels.value.has(c.panel.id)).length)
const failedPanel = (id: string) => ill.latest.value.get(id)?.status === 'failed'
const compareId = ref<string | null>(null)
const review = useReview(s, computed(() => s.episode.value?.settings.aspect))
const exportPages = computed(() => {
  const m = new Map<string, Cut[]>()
  for (const c of s.cuts.value) m.set(c.page.id, [...(m.get(c.page.id) ?? []), c])
  return [...m.values()]
})
// PUB-12·14: 제보자 크레딧과 철회된 재료 썰
const credit = computed(() => creditLine(story.sources.value.map(x => x.credit)))
const creditPlace = computed(() => episode.value?.settings.creditPlace ?? 'caption')
const lastLabel = computed(() => [creditPlace.value === 'page' ? credit.value : '', episode.value?.settings.aiLabel !== false ? AI_LABEL : ''].filter(Boolean).join(' · ') || null)
const withdrawnSources = computed(() => story.sources.value.filter(x => x.status === 'withdrawn' || x.withdrawn))
const exp = useExport(s, review, exportPages, lastLabel)
// PUB-30~37 릴스 영상
const expMode = ref<'image' | 'video'>('image')
const video = useVideo(s, review, lastLabel)
const vTime = ref(0)
const vIndex = computed(() => Math.max(0, video.clips.value.findIndex(c => c.cuts.some(x => x.panel.id === selectedPanelId.value))))
const vClip = computed(() => video.clips.value[vIndex.value] ?? null)
async function exportMp4() {
  try {
    const r = await video.exportMp4()
    if (r.music && !r.audio) toast.warning(t.video.mp4NoAudio)
    else if (r.audio === 'opus') toast.warning(t.video.mp4Opus)
    else toast.success(t.video.mp4Done)
  }
  catch (e) {
    if ((e as Error).name === 'AbortError') toast.info(t.video.mp4Canceled)
    else toast.error(t.video.mp4Failed)
  }
}
function vSelect(c: { start: number, cuts: Cut[] }) {
  vTime.value = c.start
  select(c.cuts[0]!.panel.id)
}
// REV-10·14·15
const rows = computed(() => checklist(issues.value, episode.value?.settings.aiLabel !== false, episode.value?.review ?? {}, s.seriesReviewItems.value))
const left = computed(() => reviewLeft(rows.value))
const setCheck = (key: string, st: ReviewState) => run(() => s.updateEpisode({ review: { ...(episode.value?.review ?? {}), [key]: st } }))
const addItem = (label: string) => run(() => s.setSeriesReviewItems([...new Set([...s.seriesReviewItems.value, label])]))
const removeItem = (label: string) => run(() => s.setSeriesReviewItems(s.seriesReviewItems.value.filter(x => x !== label)))
// ILL-31: 다른 컷 후보 + 참고 자료
const assetLib = useAssets()
const pickList = computed(() => [
  ...assetLib.generated.value.filter(g => g.panelId !== selected.value?.panel.id).slice(0, 60).map(g => ({ id: g.id, path: g.imagePath })),
  ...assetLib.assets.value.map(x => ({ id: x.id, path: x.path })),
])
// ILL-21·22
async function illVariant(id: string) {
  const c = ill.candidates.value.find(x => x.id === id)
  const change = await promptDialog(t.illustrate.variantPrompt)
  if (!c || change === null || !selected.value) return
  await run(() => ill.edit(selected.value!, c, 'variant', { change }), t.illustrate.started(1))
}
async function illInpaint(id: string, mask: Blob, change: string) {
  const c = ill.candidates.value.find(x => x.id === id)
  const cut = selected.value
  if (!c || !cut) return
  await run(async () => ill.edit(cut, c, 'inpaint', { change, maskPath: await lib.upload('panels', cut.panel.id, new File([mask], 'mask.png', { type: 'image/png' })) }), t.illustrate.started(1))
}
// PUB-10·11·20
const captionText = computed(() => episode.value?.caption?.text ?? '')
const fullCaption = computed(() => composeCaption({ greeting: s.series.value?.greeting, text: captionText.value, hashtags: episode.value?.caption?.hashtags, fixedTags: s.series.value?.hashtags, credit: creditPlace.value === 'caption' ? credit.value : '', aiLabel: episode.value?.settings.aiLabel !== false }))
const captionCost = computed(() => lib.estimateText('publish.caption', story.material.value.length))
const makeCaption = () => (story.active.value ? run(() => story.caption(story.active.value!), t.publish.captionStarted) : toast.warning(t.board.needStory))
const setCaptionText = (text: string) => run(() => s.updateEpisode({ caption: { text: text.slice(0, 2000), hashtags: episode.value?.caption?.hashtags ?? [] } }))
const markPublished = (url: string) => run(() => s.updateEpisode({ status: 'published', published: { at: serverTimestamp(), url: url.slice(0, 500) } }), t.publish.published)
const unpublish = () => run(() => s.updateEpisode({ status: 'done', published: null }))
const publishedInfo = computed(() => {
  const p = episode.value?.published
  return p ? { at: p.at ? new Date(p.at.toMillis()).toLocaleDateString('ko-KR') : '', url: p.url } : null
})
async function guardExport(fn: () => unknown) {
  if (left.value && !await confirmDialog(t.review.notPassed(left.value))) return
  if (withdrawnSources.value.length && !await confirmDialog(t.publish.withdrawnConfirm(withdrawnSources.value.length))) return
  return fn()
}
const expPage = ref(0)
watch(() => s.cuts.value.find(c => c.panel.id === selectedPanelId.value)?.pageIndex, i => (expPage.value = i ?? 0), { immediate: true })
const runExport = (fn: () => Promise<void>) => fn().catch(() => toast.error(t.publish.failed))
const bubbleSel = ref<{ panelId: string, dialogueId: string } | null>(null)
const selBubble = computed(() => (bubbleSel.value?.panelId === selectedPanelId.value ? bubbleSel.value.dialogueId : null))
const pageCutsOf = computed(() => (id?: string) => s.cuts.value.filter(c => c.page.id === id))
const issues = computed(() => autoCheck(s.cuts.value))
const tpl = useBubbleTemplates()
// ILL-43·REV-13: 그림 있는 컷(일관성은 캐릭터가 있는 컷)을 앞에서부터 AI_CHECK_MAX개
const checkCuts = (mode: AiCheckMode) => s.cuts.value.filter(c => c.panel.selectedCandidateId && (mode === 'quality' || c.panel.characterIds?.length)).slice(0, AI_CHECK_MAX)
const checkInfo = computed(() => Object.fromEntries(AI_CHECK_MODES.map((m) => {
  const n = checkCuts(m).length
  return [m, { n, cost: lib.estimateText('panel.check', n * IMAGE_CHARS + 300) }]
})) as Record<AiCheckMode, { n: number, cost: number }>)
function runCheck(mode: AiCheckMode) {
  const cuts = checkCuts(mode)
  if (!cuts.length) return toast.warning(t.review.ai.none)
  const ids = new Set(cuts.flatMap(c => c.panel.characterIds ?? []))
  const characters = lib.characters.value.filter(c => ids.has(c.id)).map(c => `${c.name}: ${c.appearanceText || '-'}`).join('\n').slice(0, 4000)
  return run(() => review.aiCheck({ mode, panelIds: cuts.map(c => c.panel.id), ...(mode === 'consistency' ? { characters } : {}) }), t.review.ai.started)
}
const aiItems = computed(() => (s.episode.value?.aiCheck?.items ?? []).map(i => ({ ...i, number: s.cuts.value.find(c => c.panel.id === i.panelId)?.number ?? 0 })).filter(i => i.number))
function onBubble(panelId: string, dialogueId: string | null) {
  if (panelId !== selectedPanelId.value) select(panelId)
  bubbleSel.value = dialogueId ? { panelId, dialogueId } : null
}
async function placeAll(force: boolean) {
  if (force && !await confirmDialog(t.review.replaceAllConfirm)) return
  await run(() => review.place(s.cuts.value, force), t.review.placed)
}
async function illGenerate(list: Cut[], n: number, opts: { extra?: string, leaveRoom?: boolean }) {
  await run(() => ill.generate(list, n, opts), t.illustrate.started(list.length))
}
// ILL-02 한꺼번에
async function bulk(mode: 'empty' | 'stale') {
  const list = bulkTargets(cuts.value, mode, s.busyPanels.value)
  if (!list.length || !await confirmDialog(t.illustrate.bulkConfirm(list.length, illN.value, lib.estimate(list.length * illN.value)))) return
  await illGenerate(list, illN.value, { leaveRoom: true })
}
// ILL-06
async function illCancel(job: PanelJob) {
  if (job.status === 'running' && !await confirmDialog(t.illustrate.cancelRunning)) return
  await run(() => ill.cancel(job.id), t.illustrate.canceled)
}
// SBD-12: 인물 이름을 고치면 캐릭터 연결도 다시
function editPanel(panel: Panel, field: keyof Panel, value: unknown) {
  queueEdit(panel, field, value)
  if (field === 'characterNames') queueEdit(panel, 'characterIds', matchCharacters(value as string[], lib.characters.value))
}
// CHR-10 즉석 캐릭터
async function makeCharacter(panel: Panel, name: string, once: boolean) {
  await run(async () => {
    const ref = await lib.createCharacter({ name, episodeId: once ? episode.value!.id : null })
    queueEdit(panel, 'characterIds', [...new Set([...(panel.characterIds ?? []), ref.id])])
  }, ko.library.created)
}
const storySel = computed(() => String(route.query.version ?? '') || story.active.value?.id || story.versions.value.at(-1)?.id || '')
const storyVersion = computed(() => story.versions.value.find(v => v.id === storySel.value) ?? null)
// STO-23
const storyCompareId = ref('')
const compareVersion = computed(() => story.versions.value.find(v => v.id === storyCompareId.value && v.id !== storySel.value) ?? null)
const running = (type: string) => s.jobs.value.filter(j => j.type === type).length
const selectVersion = (id: string) => router.replace({ query: { ...route.query, version: id } })

async function run(fn: () => Promise<unknown>, ok?: string) {
  try {
    await fn()
    if (ok) toast.success(ok)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.unknown)
  }
}

// STU-10·11 단계 탭
const state = computed(() => ({ activeStoryVersionId: episode.value?.activeStoryVersionId ?? null, status: episode.value?.status ?? 'active' as const, cuts: cuts.value, reviewLeft: left.value }))
const step = computed<Step>(() => (STEPS as readonly string[]).includes(String(route.query.step)) ? route.query.step as Step : episode.value?.step ?? 'story')
function needText(st: Step) {
  const n = remaining(st, state.value)
  const need = t.need[st]
  return typeof need === 'function' ? need(n) : need
}
function goStep(st: Step) {
  const unmet = firstUnmetBefore(st, state.value)
  if (unmet) toast.warning(t.unmet(t.steps[unmet], needText(unmet)))
  router.replace({ query: { ...route.query, step: st } })
  if (edit.value && st !== episode.value?.step) run(() => s.setStep(st))
}

// STU-02 컷 선택 (단계를 바꿔도 유지)
const selectedId = computed(() => String(route.query.panel ?? '') || cuts.value[0]?.panel.id || '')
const selectedIndex = computed(() => cuts.value.findIndex(c => c.panel.id === selectedId.value))
const selected = computed<Cut | undefined>(() => cuts.value[selectedIndex.value])
function select(id: string) {
  flush()
  router.replace({ query: { ...route.query, panel: id } })
}
function step1(dir: -1 | 1) {
  const c = cuts.value[selectedIndex.value + dir]
  if (c) select(c.panel.id)
}
const pageCount = computed(() => new Set(cuts.value.map(c => c.page.id)).size)
function jumpPage(i: number) {
  const c = cuts.value.find(c => c.pageIndex === i)
  if (c) select(c.panel.id)
}

// STU-03 패널 접기·폭
const leftOpen = useLocalStorage('toonflow:studio:leftOpen', true)
const rightOpen = useLocalStorage('toonflow:studio:rightOpen', true)
const leftW = useLocalStorage('toonflow:studio:leftW', 260)
const rightW = useLocalStorage('toonflow:studio:rightW', 320)
function resize(e: PointerEvent, side: 'left' | 'right') {
  const startX = e.clientX
  const start = side === 'left' ? leftW.value : rightW.value
  const move = (ev: PointerEvent) => {
    const d = side === 'left' ? ev.clientX - startX : startX - ev.clientX
    const w = Math.min(480, Math.max(200, start + d))
    if (side === 'left') leftW.value = w
    else rightW.value = w
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

// STU-04·20 제목 바로 수정 + 자동 저장
const titleDraft = ref('')
watch(() => episode.value?.title, v => v !== undefined && (titleDraft.value = v), { immediate: true })
const saveTitle = useDebounceFn(() => {
  const v = titleDraft.value.trim()
  if (v && v !== episode.value?.title) run(() => s.rename(v))
}, 600)
const now = ref(Date.now())
useIntervalFn(() => (now.value = Date.now()), 15000)
const saveLabel = computed(() => {
  if (s.pending.value > 0) return t.saving
  if (s.failed.value) return t.saveFailed
  if (!s.savedAt.value) return ''
  const sec = Math.round((now.value - s.savedAt.value) / 1000)
  return `${t.saved} · ${sec < 60 ? t.justNow : `${Math.round(sec / 60)}분 전`}`
})

// 속성 패널 자동 저장: 컷이 바뀌면 남은 수정부터 저장
let queued: { id: string, patch: Partial<Panel> } | null = null
const flushLater = useDebounceFn(() => flush(), 600)
function flush() {
  if (!queued) return
  const { id, patch } = queued
  queued = null
  run(() => s.updatePanel(id, patch))
}
const STALE_BY_FIELD: Partial<Record<keyof Panel, StaleFrom>> = { scene: 'scene', dialogues: 'dialogue' }
function queueEdit(panel: Panel, field: keyof Panel, value: unknown) {
  if (queued && queued.id !== panel.id) flush()
  const patch: Partial<Panel> = { ...queued?.patch, [field]: value }
  // STU-12: 이미지를 고른 컷의 장면·대사가 바뀌면 영향 받음
  const stale = STALE_BY_FIELD[field]
  if (stale && panel.selectedCandidateId) patch.staleFrom = stale
  queued = { id: panel.id, patch }
  flushLater()
}
/** 대본 보기처럼 칸을 벗어날 때 저장하는 편집은 바로 */
function saveNow(panel: Panel, field: keyof Panel, value: unknown) {
  queueEdit(panel, field, value)
  flush()
}

// SBD-01·02·03 자동 콘티 · 다시 나누기 · 빈 콘티
const view = useLocalStorage<'cut' | 'board' | 'script'>('toonflow:studio:view', 'cut')
const lastOpened = useLocalStorage<Record<string, string>>('toonflow:studio:last', {})
watch(() => episode.value?.id, (id) => {
  const ws = auth.workspace?.id
  if (id && ws) lastOpened.value = { ...lastOpened.value, [ws]: id }
}, { immediate: true })
async function autoSplit() {
  const v = story.active.value
  if (!v) return toast.warning(t.board.needStory)
  if (cuts.value.length) {
    const drawn = cuts.value.filter(c => c.panel.selectedCandidateId).length
    if (!await confirmDialog(t.board.resplitConfirm(drawn))) return
  }
  await run(() => story.split(v), t.story.started)
}

// SBD-21 끌어서 옮기기
const dragId = ref<string | null>(null)
async function dropOn(c: Cut) {
  const id = dragId.value
  dragId.value = null
  if (!id || id === c.panel.id) return
  await run(async () => {
    if (!(await s.dropPanel(id, c.page.id, c.indexInPage))) toast.warning(t.board.full)
  })
}
async function duplicate(id: string) {
  await run(async () => {
    const copy = await s.duplicatePanel(id)
    if (copy) select(copy)
  })
}
onBeforeUnmount(flush)

// STU-21·22 편집·실행 취소
async function addPage() {
  await run(async () => select(await s.addPage(selected.value?.page.id)))
}
async function addPanel(pageId: string) {
  await run(async () => {
    const id = await s.addPanel(pageId)
    if (id) select(id)
  })
}
async function removePanel(id: string) {
  const next = cuts.value[selectedIndex.value + 1] ?? cuts.value[selectedIndex.value - 1]
  await run(() => s.deletePanel(id))
  if (id === selectedId.value && next) select(next.panel.id)
  toast(t.deleted, { action: { label: t.undo, onClick: () => run(s.undo) } })
}
const typing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '') || !!compareId.value
onKeyStroke(['z', 'Z'], (e) => {
  if (!(e.metaKey || e.ctrlKey) || typing() || !edit.value) return
  e.preventDefault()
  run(e.shiftKey ? s.redo : s.undo)
})

// STU-31·32 이동·전체 미리보기
const previewOpen = ref(false)
const snapOpen = ref(false)
const previewPage = ref(0)
function openPreview() {
  previewPage.value = selected.value?.pageIndex ?? 0
  previewOpen.value = true
}
const previewCuts = computed(() => cuts.value.filter(c => c.pageIndex === previewPage.value))
onKeyStroke(['ArrowLeft', 'ArrowRight', 'Escape'], (e) => {
  if (typing()) return
  const dir = e.key === 'ArrowLeft' ? -1 : 1
  if (previewOpen.value) {
    if (e.key === 'Escape') previewOpen.value = false
    else previewPage.value = Math.min(pageCount.value - 1, Math.max(0, previewPage.value + dir))
  }
  else if (e.key !== 'Escape') {
    step1(dir)
  }
})

// STU-30 단축키: 1~5 단계, J/K 이전·다음 컷, G 선택 컷 그림 생성, ? 단축키 목록
const keysOpen = ref(false)
onKeyStroke(['1', '2', '3', '4', '5', 'j', 'J', 'k', 'K', 'g', 'G', '?'], (e) => {
  if (typing() || e.metaKey || e.ctrlKey || e.altKey || previewOpen.value || snapOpen.value) return
  const k = e.key.toLowerCase()
  if (k === '?') keysOpen.value = !keysOpen.value
  else if (k === 'j' || k === 'k') step1(k === 'j' ? 1 : -1)
  else if (k === 'g') {
    if (step.value === 'illustrate' && edit.value && selected.value && !s.busyPanels.value.has(selected.value.panel.id)) illGenerate([selected.value], illN.value, {})
  }
  else goStep(STEPS[Number(k) - 1]!)
})
onKeyStroke('Escape', () => (keysOpen.value = false))

const aspect = computed(() => (episode.value?.settings.aspect ?? '4:5').replace(':', ' / '))
const krw = (n: number) => `₩${(n ?? 0).toLocaleString('ko-KR')}`
const gridClass: Record<string, string> = { '1': 'grid-cols-1', '2v': 'grid-rows-2', '2h': 'grid-cols-2', '3': 'grid-rows-3', '4': 'grid-cols-2 grid-rows-2' }
</script>

<template>
  <StudioEpisodePicker v-if="!episodeId" />
  <div v-else-if="s.missing.value" class="p-8">
    <AppEmptyState :icon="Clapperboard" :title="t.notFound" :body="ko.empty.studio.body">
      <NuxtLink to="/stories" class="text-sm underline">
        Stories
      </NuxtLink>
    </AppEmptyState>
  </div>
  <div v-else-if="episode" class="flex h-[calc(100dvh-3.5rem)] flex-col">
    <!-- 위: 에피소드 정보 · 단계 탭 · 저장 상태 -->
    <div class="flex flex-wrap items-center gap-3 border-b px-4 py-2">
      <NuxtLink :to="{ path: '/studio', query: { pick: '1' } }" class="text-muted-foreground text-xs hover:underline">
        ← {{ t.picker.switch }}
      </NuxtLink>
      <NuxtLink :to="{ path: '/stories' }" class="text-muted-foreground text-sm hover:underline">
        {{ s.seriesName.value }}
      </NuxtLink>
      <span class="text-muted-foreground">›</span>
      <input
        v-model="titleDraft" :disabled="!edit" maxlength="80" :aria-label="ko.stories.title"
        class="hover:border-input focus:border-input w-48 rounded border border-transparent bg-transparent px-1.5 py-0.5 font-semibold"
        @input="saveTitle" @blur="saveTitle"
      >
      <span class="bg-muted rounded px-2 py-0.5 text-xs">{{ ko.stories.stages[stageOf(episode)] }}</span>
      <span class="text-muted-foreground text-xs">{{ t.cost }} {{ krw(episode.costKrw) }}</span>
      <nav class="mx-auto flex gap-1" role="tablist">
        <button
          v-for="st in STEPS" :key="st" role="tab" :aria-selected="step === st"
          class="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm" :class="step === st ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted'"
          :title="remaining(st, state) ? needText(st) : ''" @click="goStep(st)"
        >
          <Check v-if="remaining(st, state) === 0" class="size-3.5" />
          {{ t.steps[st] }} <span class="text-xs opacity-70">{{ t.stepsKo[st] }}</span>
        </button>
      </nav>
      <span class="text-muted-foreground text-xs" aria-live="polite">
        {{ saveLabel }}
        <button v-if="s.failed.value" class="underline" @click="run(s.retry)">{{ t.retry }}</button>
      </span>
      <template v-if="edit">
        <Button size="icon" variant="ghost" :disabled="!s.canUndo.value" :aria-label="t.undo" @click="run(s.undo)">
          <Undo2 class="size-4" />
        </Button>
        <Button size="icon" variant="ghost" :disabled="!s.canRedo.value" :aria-label="t.redo" @click="run(s.redo)">
          <Redo2 class="size-4" />
        </Button>
      </template>
      <div v-if="step !== 'story'" class="flex rounded-md border p-0.5" role="group">
        <button v-for="v in (['cut', 'board', 'script'] as const)" :key="v" class="rounded px-2 py-1 text-xs" :class="view === v ? 'bg-muted font-semibold' : ''" :aria-pressed="view === v" @click="view = v">
          {{ t.board.views[v] }}
        </button>
      </div>
      <span v-if="presence.samePanel.value.length" class="bg-warning/15 text-warning rounded px-2 py-1 text-xs" role="status">{{ ko.presence.samePanel(presence.samePanel.value.map(p => p.name ?? '?').join(', ')) }}</span>
      <div v-if="presence.others.value.length" class="flex -space-x-2" :aria-label="ko.presence.viewing(presence.others.value.length)">
        <span v-for="p in presence.others.value.slice(0, 4)" :key="p.id" class="bg-muted ring-background flex size-7 items-center justify-center overflow-hidden rounded-full text-xs font-semibold ring-2" :title="p.name ?? ''">
          <img v-if="p.photoURL" :src="p.photoURL" alt="" class="size-full object-cover">
          <template v-else>{{ (p.name ?? '?').slice(0, 1) }}</template>
        </span>
        <span v-if="presence.others.value.length > 4" class="bg-muted ring-background flex size-7 items-center justify-center rounded-full text-xs ring-2">+{{ presence.others.value.length - 4 }}</span>
      </div>
      <Button size="sm" variant="outline" :disabled="!cuts.length" @click="openPreview">
        <Eye class="size-4" /> {{ t.preview }}
      </Button>
      <Button size="sm" variant="outline" @click="snapOpen = true">
        <History class="size-4" /> {{ t.snap.button }}
      </Button>
    </div>

    <div class="flex min-h-0 flex-1">
      <!-- 왼쪽: 장·컷 목록 (Story 단계는 각색안 목록) -->
      <aside v-if="leftOpen" class="relative flex shrink-0 flex-col border-r" :style="{ width: `${leftW}px` }">
        <div class="flex items-center justify-between px-3 py-2">
          <span class="text-sm font-semibold">{{ step === 'story' ? t.storyTitle : t.pagesTitle }}</span>
          <Button size="icon" variant="ghost" :aria-label="t.collapse" @click="leftOpen = false">
            <PanelLeftClose class="size-4" />
          </Button>
        </div>
        <StudioStoryList
          v-if="step === 'story'" :versions="story.versions.value" :active-id="episode.activeStoryVersionId ?? null" :selected-id="storySel" :edit="edit"
          :running="running('story.draft')" :has-material="!!story.material.value" @select="selectVersion" @make="(n, req) => run(() => story.draft(n, req), t.story.started)"
        />
        <div v-else class="flex-1 overflow-y-auto px-2 pb-2">
          <p v-if="!cuts.length" class="text-muted-foreground px-1 text-sm">
            {{ t.noCuts }}
          </p>
          <div v-if="edit && step === 'storyboard'" class="flex flex-col gap-1.5 px-1 pt-1">
            <p v-if="running('storyboard.split')" class="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Loader2 class="size-3.5 animate-spin" /> {{ t.board.splitting }}
            </p>
            <Button v-else size="sm" :variant="cuts.length ? 'outline' : 'default'" :disabled="!story.active.value" :title="story.active.value ? '' : t.board.needStory" @click="autoSplit">
              <Sparkles class="size-4" /> {{ cuts.length ? t.board.resplit : t.board.auto }}
            </Button>
            <Button v-if="edit && cuts.length && (s.series.value?.coverText || s.series.value?.outroText)" size="sm" variant="ghost" @click="run(() => s.addFixedPages(s.series.value?.coverText, s.series.value?.outroText), t.board.fixedDone)">
              {{ t.board.fixed }}
            </Button>
            <Button v-if="!cuts.length" size="sm" variant="ghost" @click="addPage">
              {{ t.board.blank }}
            </Button>
          </div>
          <div v-if="edit && step === 'review' && cuts.length" class="flex flex-col gap-1.5 px-1 pt-1">
            <Button size="sm" @click="placeAll(false)">{{ t.review.autoPlace }}</Button>
            <Button size="sm" variant="outline" @click="placeAll(true)">{{ t.review.replaceAll }}</Button>
          </div>
          <div v-if="edit && step === 'illustrate' && cuts.length" class="flex flex-col gap-1.5 px-1 pt-1">
            <Button size="sm" :disabled="!bulkTargets(cuts, 'empty', s.busyPanels.value).length" @click="bulk('empty')">
              <Sparkles class="size-4" /> {{ t.illustrate.allEmpty(bulkTargets(cuts, 'empty', s.busyPanels.value).length) }}
            </Button>
            <Button v-if="bulkTargets(cuts, 'stale', s.busyPanels.value).length" size="sm" variant="outline" @click="bulk('stale')">
              {{ t.illustrate.allStale(bulkTargets(cuts, 'stale', s.busyPanels.value).length) }}
            </Button>
            <p v-if="illBusy" class="text-muted-foreground text-xs">{{ t.illustrate.progress(illBusy, cuts.length) }}</p>
          </div>
          <template v-for="c in cuts" :key="c.panel.id">
            <div v-if="c.indexInPage === 0" class="text-muted-foreground mt-2 flex items-center justify-between px-1 text-xs font-medium">
              {{ t.page(c.pageIndex + 1) }}
              <span v-if="edit" class="flex gap-0.5">
                <button :aria-label="t.board.pageUp" :title="t.board.pageUp" :disabled="c.pageIndex === 0" @click="run(() => s.shiftPage(c.page.id, -1))"><ArrowUp class="size-3.5" /></button>
                <button :aria-label="t.board.pageDown" :title="t.board.pageDown" :disabled="c.pageIndex === pageCount - 1" @click="run(() => s.shiftPage(c.page.id, 1))"><ArrowDown class="size-3.5" /></button>
                <button v-if="c.page.panelIds.length < 4" :aria-label="t.addPanel" :title="t.addPanel" @click="addPanel(c.page.id)"><Plus class="size-3.5" /></button>
              </span>
            </div>
            <div
              class="group flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm" :class="c.panel.id === selectedId ? 'bg-primary/15 ring-primary ring-1' : 'hover:bg-muted'"
              :draggable="edit" @click="select(c.panel.id)" @dragstart="dragId = c.panel.id" @dragover.prevent @drop.prevent="dropOn(c)"
            >
              <GripVertical v-if="edit" class="text-muted-foreground mt-0.5 size-3.5 shrink-0 cursor-grab" />
              <span class="text-muted-foreground w-6 shrink-0 text-xs leading-5">{{ c.number }}</span>
              <StudioPanelImage v-if="c.panel.selectedCandidateId" :candidate-id="c.panel.selectedCandidateId" :panel-id="c.panel.id" :crop="c.panel.crop" :adjust="c.panel.adjust" class="relative h-10 w-8 shrink-0 rounded-sm" />
              <span class="line-clamp-2 flex-1" :class="{ 'text-muted-foreground italic': !c.panel.scene }">{{ c.panel.scene || t.noScene }}</span>
              <Loader2 v-if="s.busyPanels.value.has(c.panel.id)" class="size-3.5 animate-spin" :aria-label="t.generating" />
              <span v-else-if="failedPanel(c.panel.id)" class="bg-destructive mt-1.5 size-2 shrink-0 rounded-full" :title="t.illustrate.failed" />
              <span v-if="c.panel.staleFrom" class="mt-1.5 size-2 shrink-0 rounded-full bg-amber-500" :title="t.stale[c.panel.staleFrom]" />
              <span v-if="edit" class="hidden shrink-0 gap-0.5 group-hover:flex">
                <button :aria-label="t.moveUp" :disabled="c.number === 1" @click.stop="run(() => s.movePanel(c.panel.id, -1))"><ArrowUp class="size-3.5" /></button>
                <button :aria-label="t.moveDown" :disabled="c.number === cuts.length" @click.stop="run(() => s.movePanel(c.panel.id, 1))"><ArrowDown class="size-3.5" /></button>
                <button :aria-label="t.board.duplicate" @click.stop="duplicate(c.panel.id)"><Copy class="size-3.5" /></button>
                <button :aria-label="t.deletePanel" @click.stop="removePanel(c.panel.id)"><Trash2 class="size-3.5" /></button>
              </span>
            </div>
          </template>
          <Button v-if="edit" size="sm" variant="ghost" class="mt-2 w-full" @click="addPage">
            <Plus class="size-4" /> {{ t.addPage }}
          </Button>
        </div>
        <div class="hover:bg-primary/40 absolute top-0 -right-1 h-full w-2 cursor-col-resize" @pointerdown="resize($event, 'left')" />
      </aside>
      <Button v-else size="icon" variant="ghost" class="m-2" :aria-label="t.expand" @click="leftOpen = true">
        <PanelLeftOpen class="size-4" />
      </Button>

      <!-- 가운데: 미리보기 -->
      <section class="bg-muted/30 flex min-w-0 flex-1 flex-col items-center justify-center gap-3 p-6">
        <div v-if="step === 'story'" class="w-full flex-1 overflow-y-auto">
          <StudioStoryCompare v-if="storyVersion && compareVersion" :a="storyVersion" :b="compareVersion" @close="storyCompareId = ''" />
          <StudioStoryEditor
            v-else-if="storyVersion" :version="storyVersion" :active="storyVersion.id === episode.activeStoryVersionId" :edit="edit"
            :versions="story.versions.value" :rev="story.rewriteRev.value" :rewriting="!!story.rewriting.value"
            @rewrite="(sid, f, text, m, tone) => run(() => story.rewrite(storyVersion!, sid, f, text, m, tone))" @compare="id => (storyCompareId = id)"
            @save="patch => run(() => story.updateVersion(storyVersion!.id, patch))" @activate="run(() => story.setActive(storyVersion!.id))"
            @remake="run(() => story.draft(1, '', storyVersion!), t.story.started)"
          />
          <p v-else class="text-muted-foreground text-center text-sm">{{ t.story.empty }}</p>
        </div>
        <div v-else-if="step === 'export' && expMode === 'video' && cuts.length" class="flex w-full flex-1 flex-col items-center gap-3 overflow-y-auto">
          <StudioVideoPreview v-model="vTime" :draw="video.draw.value" :width="video.size.value.w" :height="video.size.value.h" :total="video.total.value" />
          <StudioVideoTimeline
            class="max-w-3xl" :clips="video.clips.value" :total="video.total.value" :selected-id="vClip?.id ?? ''" :edit="edit"
            @select="vSelect" @duration="(id, ms) => run(() => video.setClip(id, { durationMs: ms }))"
          />
        </div>
        <StudioExportPreview
          v-else-if="step === 'export' && cuts.length" v-model="expPage" :pages="exportPages" :aspect="episode.settings.aspect" :typeset="review.typeset.value"
          :label="lastLabel" :name="s.seriesName.value || episode.title" :watermark="s.series.value?.watermark || null"
        />
        <StudioBoardView v-else-if="view === 'board' && cuts.length" :cuts="cuts" :selected-id="selectedId" :aspect="aspect" @select="id => { select(id); view = 'cut' }" />
        <StudioScriptView v-else-if="view === 'script' && cuts.length" :cuts="cuts" :edit="edit" :selected-id="selectedId" :title="episode?.title ?? ''" @edit="saveNow" @select="select" />
        <template v-else-if="selected">
          <div v-if="withdrawnSources.length" class="flex w-full max-w-md items-center gap-2 rounded-md bg-red-100 px-3 py-2 text-xs text-red-900" role="alert">
            <span class="flex-1">{{ t.publish.withdrawnAlert(withdrawnSources.length) }}</span>
          </div>
          <div v-if="episode.staleFrom === 'story'" class="flex w-full max-w-md items-center gap-2 rounded-md bg-amber-100 px-3 py-2 text-xs text-amber-900">
            <span class="flex-1">{{ t.story.staleStory }}</span>
            <button v-if="edit" class="underline" @click="autoSplit">{{ t.board.resplit }}</button>
            <button v-if="edit" class="underline" @click="run(story.keepStale)">{{ t.keep }}</button>
          </div>
          <PageRender
            v-if="step === 'review'" class="max-h-full w-full max-w-md rounded-lg border shadow-sm" :cuts="pageCutsOf(selected.page.id)" :aspect="episode.settings.aspect"
            :typeset="review.typeset.value" :edit="edit" :selected-panel-id="selectedPanelId" :selected-bubble="selBubble"
            @select="onBubble" @move="(pid, did, patch) => run(() => review.setBubble(pid, did, patch))"
          />
          <div v-else class="bg-card relative flex max-h-full w-full max-w-md flex-col overflow-hidden items-center justify-center gap-2 rounded-lg border p-6 text-center shadow-sm" :style="{ aspectRatio: aspect }">
            <span class="text-muted-foreground absolute top-2 left-3 text-xs">{{ t.page(selected.pageIndex + 1) }} · {{ t.cut(selected.number) }}</span>
            <StudioPanelImage v-if="selected.panel.selectedCandidateId" :candidate-id="selected.panel.selectedCandidateId" :panel-id="selected.panel.id" :crop="selected.panel.crop" :adjust="selected.panel.adjust" class="absolute inset-0" />
            <template v-else>
              <p class="line-clamp-6 text-sm">{{ selected.panel.scene || t.noScene }}</p>
              <p class="text-muted-foreground text-xs">{{ step === 'illustrate' ? t.illustrate.noCandidates : t.imageSoon }}</p>
            </template>
            <Loader2 v-if="s.busyPanels.value.has(selected.panel.id)" class="absolute top-2 right-3 size-4 animate-spin" :aria-label="t.generating" />
          </div>
          <div class="flex items-center gap-2">
            <Button size="icon" variant="outline" :disabled="selectedIndex <= 0" :aria-label="t.prev" @click="step1(-1)">
              <ChevronLeft class="size-4" />
            </Button>
            <select :value="selected.pageIndex" class="border-input bg-card h-9 rounded-md border px-2 text-sm" :aria-label="t.jump" @change="jumpPage(Number(($event.target as HTMLSelectElement).value))">
              <option v-for="i in pageCount" :key="i" :value="i - 1">{{ t.page(i) }}</option>
            </select>
            <Button size="icon" variant="outline" :disabled="selectedIndex >= cuts.length - 1" :aria-label="t.next" @click="step1(1)">
              <ChevronRight class="size-4" />
            </Button>
          </div>
        </template>
        <p v-else class="text-muted-foreground text-sm">{{ t.noCuts }}</p>
      </section>

      <!-- 오른쪽: 선택한 컷의 속성 -->
      <aside v-if="rightOpen" class="relative flex shrink-0 flex-col gap-3 overflow-y-auto border-l p-3" :style="{ width: `${rightW}px` }">
        <div class="hover:bg-primary/40 absolute top-0 -left-1 h-full w-2 cursor-col-resize" @pointerdown="resize($event, 'right')" />
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold">{{ t.props }}<template v-if="selected"> · {{ t.cut(selected.number) }}</template></span>
          <Button size="icon" variant="ghost" :aria-label="t.collapse" @click="rightOpen = false">
            <PanelRightClose class="size-4" />
          </Button>
        </div>
        <StudioStoryAside
          v-if="step === 'story'" :episode="episode" :version="storyVersion" :sources="story.sources.value" :edit="edit"
          :analyzing="running('story.analyze') > 0" :titling="running('story.titles') > 0"
          :series-memo="s.series.value?.memo ?? ''" :styles="lib.styles.value" :characters="lib.characters.value" :series-style-id="s.series.value?.styleId ?? null" :series-main-ids="s.series.value?.mainCharacterIds ?? []"
          @series-style="id => run(() => lib.setSeriesStyle(episode!.seriesId, id))" @series-main="(id, on) => run(() => lib.setMain(episode!.seriesId, id, on))" @series-memo="m => run(() => s.updateSeries({ memo: m }))"
          :cover-text="s.series.value?.coverText ?? ''" :outro-text="s.series.value?.outroText ?? ''" @series-fixed="p => run(() => s.updateSeries(p))"
          @settings="patch => run(() => story.updateSettings(patch))" @analyze="run(story.analyze, t.story.started)"
          @titles="run(() => story.titles(storyVersion!), t.story.started)" @apply-title="title => run(() => s.rename(title))"
        />
        <template v-else-if="step === 'export'">
          <div class="mb-3 flex gap-1" role="tablist">
            <Button size="sm" role="tab" :aria-selected="expMode === 'image'" :variant="expMode === 'image' ? 'default' : 'outline'" @click="expMode = 'image'">{{ t.video.tabImage }}</Button>
            <Button size="sm" role="tab" :aria-selected="expMode === 'video'" :variant="expMode === 'video' ? 'default' : 'outline'" @click="expMode = 'video'"><Clapperboard class="size-3.5" /> {{ t.video.tabVideo }}</Button>
          </div>
          <StudioExportAside
            v-if="expMode === 'image'" :page-count="exportPages.length" :current-page="expPage" :aspect="episode.settings.aspect" :format="exp.fmt.value"
            :ai-label="exp.aiLabel.value" :progress="exp.progress.value" :edit="edit"
            :credit="credit" :credit-place="creditPlace" :hi-res="!!episode.settings.hiRes" :planned-at="episode.settings.plannedAt ?? ''" :withdrawn="withdrawnSources.length"
            :caption="fullCaption" :caption-text="captionText" :hashtags="episode.caption?.hashtags ?? []" :published="publishedInfo" :caption-cost="captionCost" :captioning="running('publish.caption') > 0"
            :series="{ hashtags: s.series.value?.hashtags ?? '', greeting: s.series.value?.greeting ?? '', watermark: s.series.value?.watermark ?? '' }"
            @make-caption="makeCaption" @caption-text="setCaptionText" @series="p => run(() => s.updateSeries(p))" @publish="markPublished" @unpublish="unpublish"
            @settings="patch => run(() => s.updateEpisode({ settings: { ...episode!.settings, ...patch } }))" @all="guardExport(() => runExport(exp.all))" @one="guardExport(() => runExport(() => exp.one(expPage)))"
          />
          <StudioVideoAside
            v-else :settings="video.settings.value" :clips="video.clips.value" :clip="vClip" :index="vIndex" :total="video.total.value" :edit="edit"
            :music-url="video.musicUrl.value" :music-name="video.musicName.value" :supported="video.supported.value" :progress="video.progress.value"
            @save="p => run(() => video.save(p))" @clip="(id, p) => run(() => video.setClip(id, p))" @auto="id => run(() => video.autoDuration(id))" @all="ms => run(() => video.allDuration(ms))"
            @upload="f => run(() => video.uploadMusic(f), t.video.musicUploaded)" @remove-music="run(() => video.removeMusic())" @mp4="guardExport(exportMp4)" @cancel="video.cancelExport()"
          />
        </template>
        <StudioReviewAside
          v-else-if="step === 'review' && selected" :cut="selected" :bubbles="review.bubblesOf(selected)" :selected="selBubble" :typeset="review.typeset.value" :issues="issues" :edit="edit" :checklist="rows" :left="left"
          :ai-check="s.episode.value?.aiCheck ?? null" :ai-items="aiItems" :check-info="checkInfo" :checking="running('panel.check') > 0" :templates="tpl.templates.value"
          @ai-check="runCheck" @pick-panel="id => onBubble(id, null)" @save-template="(n, b) => run(() => tpl.save(n, b), t.review.tpl.saved)"
          @check="setCheck" @add-item="addItem" @remove-item="removeItem"
          @text="(did, text) => run(() => review.setText(selected!.panel.id, did, text))" @bubble="(did, patch) => run(() => review.setBubble(selected!.panel.id, did, patch))"
          @typeset="patch => run(() => review.setTypeset(patch))" @replace="run(() => review.place([selected!], true), t.review.placed)"
          @pick="is => onBubble(is.panelId, is.dialogueId ?? null)"
        />
        <StudioIllustrateAside
          v-else-if="step === 'illustrate' && selected" :cut="selected" :candidates="ill.candidates.value" :job="ill.latest.value.get(selected.panel.id)" :edit="edit"
          :style-name="ill.style.value?.name ?? ''" :character-names="selected.panel.characterNames" :prompt-of="o => ill.promptOf(selected!, o)" :estimate="lib.estimate"
          @generate="(n, o) => illGenerate([selected!], n, o)" @cancel="illCancel" @retry="id => run(() => ill.retry(id))"
          @choose="id => run(() => ill.choose(selected!.panel.id, id))" @compare="id => (compareId = id)" @crop="c => run(() => ill.setCrop(selected!.panel.id, c))" @adjust="a => run(() => ill.setAdjust(selected!.panel.id, a))" @flag="(id, p) => run(() => ill.setFlag(selected!.panel.id, id, p))" @variant="illVariant" @inpaint="illInpaint" :library="pickList" @import="p => run(() => ill.importCandidate(selected!, p), t.illustrate.uploaded)" @upload="f => run(() => ill.uploadCandidate(selected!, f), t.illustrate.uploaded)"
        />
        <template v-else-if="selected">
          <div v-if="selected.panel.staleFrom" class="flex items-center justify-between gap-2 rounded-md bg-amber-100 px-2 py-1.5 text-xs text-amber-900">
            {{ t.stale[selected.panel.staleFrom] }}
            <button v-if="edit" class="underline" @click="run(() => s.updatePanel(selected!.panel.id, { staleFrom: null }))">{{ t.keep }}</button>
          </div>
          <StudioPanelProps :panel="selected.panel" :page="selected.page" :edit="edit" :styles="lib.styles.value" :refining="story.rewriting.value?.panelId === selected.panel.id" @refine="run(() => story.refine(selected!.panel.id, selected!.panel.scene))" @split="run(() => s.splitPanel(selected!.panel.id), t.board.splitDone)" @merge="run(() => s.mergeNext(selected!.panel.id), t.board.mergeDone)" @ref-upload="f => run(async () => s.updatePanel(selected!.panel.id, { refImage: await lib.upload('panels', selected!.panel.id, f) }))" @ref-remove="run(() => s.updatePanel(selected!.panel.id, { refImage: null }))" @edit="(f, v) => editPanel(selected!.panel, f, v)" :characters="lib.characters.value" @create="(n, once) => makeCharacter(selected!.panel, n, once)" @layout="l => run(() => s.setLayout(selected!.page.id, l))" />
        </template>
        <p v-else class="text-muted-foreground text-sm">{{ t.noSelection }}</p>
      </aside>
      <Button v-else size="icon" variant="ghost" class="m-2" :aria-label="t.expand" @click="rightOpen = true">
        <PanelRightOpen class="size-4" />
      </Button>
    </div>

    <StudioCompare
      v-if="compareId && selected" :candidates="ill.candidates.value" :current-id="selected.panel.selectedCandidateId" :start-id="compareId" :aspect="aspect" :edit="edit"
      @close="compareId = null" @choose="id => { run(() => ill.choose(selected!.panel.id, id)); compareId = null }"
    />
    <!-- STU-32 전체 미리보기 -->
    <StudioSnapshots v-if="snapOpen" :s="s" :edit="edit" @close="snapOpen = false" />
    <div v-if="previewOpen" class="fixed inset-0 z-50 flex items-center justify-center gap-4 bg-black/80" role="dialog" :aria-label="t.preview">
      <button class="absolute top-4 right-4 text-white" :aria-label="t.close" @click="previewOpen = false"><X class="size-6" /></button>
      <button class="text-white disabled:opacity-30" :disabled="previewPage === 0" :aria-label="t.prev" @click="previewPage--"><ChevronLeft class="size-8" /></button>
      <div class="flex h-[85dvh] flex-col items-center gap-2">
        <PageRender v-if="(step === 'review' || step === 'export') && episode" class="h-full w-auto bg-white" :style="{ aspectRatio: aspect }" :cuts="previewCuts" :aspect="episode.settings.aspect" :typeset="review.typeset.value" />
        <div v-else class="grid h-full gap-1 bg-white p-1" :class="gridClass[previewCuts[0]?.page.layout ?? '1']" :style="{ aspectRatio: aspect }">
          <div v-for="c in previewCuts" :key="c.panel.id" class="relative flex items-center justify-center overflow-hidden bg-neutral-100 p-3 text-center text-xs text-neutral-600">
            <StudioPanelImage v-if="c.panel.selectedCandidateId" :candidate-id="c.panel.selectedCandidateId" :panel-id="c.panel.id" :crop="c.panel.crop" :adjust="c.panel.adjust" class="absolute inset-0" />
            <template v-else>{{ c.panel.scene || t.noScene }}</template>
          </div>
        </div>
        <span class="text-sm text-white">{{ previewPage + 1 }} / {{ pageCount }}</span>
      </div>
      <button class="text-white disabled:opacity-30" :disabled="previewPage >= pageCount - 1" :aria-label="t.next" @click="previewPage++"><ChevronRight class="size-8" /></button>
    </div>
    <div v-if="keysOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30" @click.self="keysOpen = false">
      <div class="bg-popover w-80 rounded-lg border p-4 text-sm shadow-lg" role="dialog" :aria-label="t.keys.title">
        <h2 class="mb-2 font-semibold">{{ t.keys.title }}</h2>
        <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <template v-for="(d, k) in t.keys.list" :key="k"><dt><kbd class="bg-muted rounded px-1.5 text-xs">{{ k }}</kbd></dt><dd>{{ d }}</dd></template>
        </dl>
      </div>
    </div>
  </div>
</template>
