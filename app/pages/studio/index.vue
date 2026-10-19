<script setup lang="ts">
import type { Step } from '#shared/episodes'
import type { Cut, Panel } from '#shared/studio'
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Clapperboard, Eye, Loader2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus, Redo2, Trash2, Undo2, X } from '@lucide/vue'
import { onKeyStroke, useDebounceFn, useIntervalFn, useLocalStorage } from '@vueuse/core'
import { toast } from 'vue-sonner'
import { stageOf, STEPS } from '#shared/episodes'
import { canEdit } from '#shared/roles'
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

async function run(fn: () => Promise<unknown>) {
  try {
    await fn()
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.unknown)
  }
}

// STU-10·11 단계 탭
const state = computed(() => ({ activeStoryVersionId: episode.value?.activeStoryVersionId ?? null, status: episode.value?.status ?? 'active' as const, cuts: cuts.value }))
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
function queueEdit(panel: Panel, field: 'scene' | 'note', value: string) {
  if (queued && queued.id !== panel.id) flush()
  const patch: Partial<Panel> = { ...queued?.patch, [field]: value }
  // STU-12: 이미지를 고른 컷의 장면이 바뀌면 영향 받음
  if (field === 'scene' && panel.selectedCandidateId) patch.staleFrom = 'scene'
  queued = { id: panel.id, patch }
  flushLater()
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
const typing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '')
onKeyStroke(['z', 'Z'], (e) => {
  if (!(e.metaKey || e.ctrlKey) || typing() || !edit.value) return
  e.preventDefault()
  run(e.shiftKey ? s.redo : s.undo)
})

// STU-31·32 이동·전체 미리보기
const previewOpen = ref(false)
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

const aspect = computed(() => (episode.value?.settings.aspect ?? '4:5').replace(':', ' / '))
const krw = (n: number) => `₩${(n ?? 0).toLocaleString('ko-KR')}`
const gridClass: Record<string, string> = { '1': 'grid-cols-1', '2v': 'grid-rows-2', '2h': 'grid-cols-2', '3': 'grid-rows-3', '4': 'grid-cols-2 grid-rows-2' }
</script>

<template>
  <AppMenuPage v-if="!episodeId" menu="studio" />
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
      <Button size="sm" variant="outline" :disabled="!cuts.length" @click="openPreview">
        <Eye class="size-4" /> {{ t.preview }}
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
        <p v-if="step === 'story'" class="text-muted-foreground px-3 text-sm">
          {{ t.storySoon }}
        </p>
        <div v-else class="flex-1 overflow-y-auto px-2 pb-2">
          <p v-if="!cuts.length" class="text-muted-foreground px-1 text-sm">
            {{ t.noCuts }}
          </p>
          <template v-for="c in cuts" :key="c.panel.id">
            <div v-if="c.indexInPage === 0" class="text-muted-foreground mt-2 flex items-center justify-between px-1 text-xs font-medium">
              {{ t.page(c.pageIndex + 1) }}
              <button v-if="edit && c.page.panelIds.length < 4" :aria-label="t.addPanel" :title="t.addPanel" @click="addPanel(c.page.id)">
                <Plus class="size-3.5" />
              </button>
            </div>
            <div
              class="group flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm" :class="c.panel.id === selectedId ? 'bg-primary/15 ring-primary ring-1' : 'hover:bg-muted'"
              @click="select(c.panel.id)"
            >
              <span class="text-muted-foreground w-6 shrink-0 text-xs leading-5">{{ c.number }}</span>
              <span class="line-clamp-2 flex-1" :class="{ 'text-muted-foreground italic': !c.panel.scene }">{{ c.panel.scene || t.noScene }}</span>
              <Loader2 v-if="s.busyPanels.value.has(c.panel.id)" class="size-3.5 animate-spin" :aria-label="t.generating" />
              <span v-if="c.panel.staleFrom" class="mt-1.5 size-2 shrink-0 rounded-full bg-amber-500" :title="t.stale[c.panel.staleFrom]" />
              <span v-if="edit" class="hidden shrink-0 gap-0.5 group-hover:flex">
                <button :aria-label="t.moveUp" :disabled="c.number === 1" @click.stop="run(() => s.movePanel(c.panel.id, -1))"><ArrowUp class="size-3.5" /></button>
                <button :aria-label="t.moveDown" :disabled="c.number === cuts.length" @click.stop="run(() => s.movePanel(c.panel.id, 1))"><ArrowDown class="size-3.5" /></button>
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
        <template v-if="selected">
          <div class="bg-card relative flex max-h-full w-full max-w-md flex-col items-center justify-center gap-2 rounded-lg border p-6 text-center shadow-sm" :style="{ aspectRatio: aspect }">
            <span class="text-muted-foreground absolute top-2 left-3 text-xs">{{ t.page(selected.pageIndex + 1) }} · {{ t.cut(selected.number) }}</span>
            <p class="line-clamp-6 text-sm">{{ selected.panel.scene || t.noScene }}</p>
            <p class="text-muted-foreground text-xs">{{ t.imageSoon }}</p>
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
        <template v-if="selected">
          <div v-if="selected.panel.staleFrom" class="flex items-center justify-between gap-2 rounded-md bg-amber-100 px-2 py-1.5 text-xs text-amber-900">
            {{ t.stale[selected.panel.staleFrom] }}
            <button v-if="edit" class="underline" @click="run(() => s.updatePanel(selected!.panel.id, { staleFrom: null }))">{{ t.keep }}</button>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="p-scene">{{ t.scene }}</Label>
            <Textarea id="p-scene" :model-value="selected.panel.scene" :disabled="!edit" rows="5" maxlength="2000" @update:model-value="queueEdit(selected!.panel, 'scene', String($event))" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="p-note">{{ t.note }}</Label>
            <Textarea id="p-note" :model-value="selected.panel.note" :disabled="!edit" rows="3" maxlength="2000" @update:model-value="queueEdit(selected!.panel, 'note', String($event))" />
          </div>
        </template>
        <p v-else class="text-muted-foreground text-sm">{{ t.noSelection }}</p>
      </aside>
      <Button v-else size="icon" variant="ghost" class="m-2" :aria-label="t.expand" @click="rightOpen = true">
        <PanelRightOpen class="size-4" />
      </Button>
    </div>

    <!-- STU-32 전체 미리보기 -->
    <div v-if="previewOpen" class="fixed inset-0 z-50 flex items-center justify-center gap-4 bg-black/80" role="dialog" :aria-label="t.preview">
      <button class="absolute top-4 right-4 text-white" :aria-label="t.close" @click="previewOpen = false"><X class="size-6" /></button>
      <button class="text-white disabled:opacity-30" :disabled="previewPage === 0" :aria-label="t.prev" @click="previewPage--"><ChevronLeft class="size-8" /></button>
      <div class="flex h-[85dvh] flex-col items-center gap-2">
        <div class="grid h-full gap-1 bg-white p-1" :class="gridClass[previewCuts[0]?.page.layout ?? '1']" :style="{ aspectRatio: aspect }">
          <div v-for="c in previewCuts" :key="c.panel.id" class="flex items-center justify-center bg-neutral-100 p-3 text-center text-xs text-neutral-600">
            {{ c.panel.scene || t.noScene }}
          </div>
        </div>
        <span class="text-sm text-white">{{ previewPage + 1 }} / {{ pageCount }}</span>
      </div>
      <button class="text-white disabled:opacity-30" :disabled="previewPage >= pageCount - 1" :aria-label="t.next" @click="previewPage++"><ChevronRight class="size-8" /></button>
    </div>
  </div>
</template>
