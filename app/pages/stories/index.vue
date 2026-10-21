<script setup lang="ts">
import type { Episode, EpisodeStage, Tone } from '#shared/episodes'
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, ArrowUpDown, BookOpen, Copy, FileText, Plus, Trash2 } from '@lucide/vue'
import { useEventListener, useLocalStorage } from '@vueuse/core'
import { serverTimestamp } from 'firebase/firestore'
import { toast } from 'vue-sonner'
import { createEpisodeInput, EPISODE_STAGES, seriesInput, stageOf, stagePatch, TONES } from '#shared/episodes'
import { canEdit } from '#shared/roles'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

const t = ko.stories
const auth = useAuthStore()
const route = useRoute()
const { series, episodes, loading, createSeries, createEpisode, updateEpisode, updateSeries, duplicate, trash } = useStories()
const { list: submissions } = useSubmissions()
const lib = useLibrary()
// EPI-05 지금 작품 · EPI-06 작품 준비(그림체 → 주요 캐릭터 → 첫 에피소드, 막지 않음)
const seriesFilter = useSeriesFilter(series)
const current = computed(() => series.value.find(s => s.id === seriesFilter.value) ?? null)
const liveStyles = computed(() => lib.styles.value.filter(s => !s.archivedAt))
const mainChars = computed(() => lib.characters.value.filter(c => !c.deletedAt && !!current.value?.mainCharacterIds?.includes(c.id)))
const setup = computed(() => {
  const s = current.value
  return [!!s?.styleId && lib.styles.value.some(x => x.id === s.styleId), mainChars.value.length > 0, !!s && episodes.value.some(e => e.seriesId === s.id)]
})
const hideSetup = useLocalStorage<string[]>('toonflow:stories:setupHidden', [])
const setStyle = (v: unknown) => current.value && run(() => lib.setSeriesStyle(current.value!.id, String(v ?? '') || null))
const dot = (done: boolean) => ['flex size-5 shrink-0 items-center justify-center rounded-full border text-xs', done ? 'bg-primary text-primary-foreground border-primary' : '']
const edit = computed(() => canEdit(auth.role))
const selectClass = 'border-input bg-card h-9 rounded-md border px-2 text-sm disabled:opacity-50'

async function run<T>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> {
  try {
    const out = await fn()
    if (ok) toast.success(ok)
    return out
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.unknown)
  }
}

// EPI-01 작품 만들기
const seriesOpen = ref(false)
const seriesForm = reactive({ name: '', intro: '', tone: 'empathy' as Tone, pageCount: 6 })
watch(() => auth.workspace?.defaults.pageCount, n => n && (seriesForm.pageCount = n), { immediate: true })
function submitSeries() {
  const parsed = seriesInput.safeParse(seriesForm)
  if (!parsed.success) return toast.error(ko.errors.invalidInput)
  return run(async () => {
    const ref = await createSeries(parsed.data)
    epForm.seriesId = ref.id
    seriesFilter.value = ref.id
    Object.assign(seriesForm, { name: '', intro: '' })
    seriesOpen.value = false
  }, t.created)
}

// EPI-10·INB-24 에피소드 만들기
const epOpen = ref(route.query.new === '1')
const epForm = reactive({
  seriesId: '',
  title: '',
  submissionIds: String(route.query.submissions ?? '').split(',').filter(Boolean),
  storyText: '',
  tone: 'empathy' as Tone,
  pageCount: 6,
  narrator: 'first' as 'first' | 'third',
})
const usable = computed(() => submissions.value.filter(s => !s.deletedAt && (s.status === 'accepted' || epForm.submissionIds.includes(s.id))))
watch([series, seriesFilter], ([list, cur]) => {
  if (cur) epForm.seriesId = cur
  else if (!epForm.seriesId && list[0]) epForm.seriesId = list[0].id
}, { immediate: true })
watch(() => epForm.seriesId, (id) => {
  const s = series.value.find(x => x.id === id)
  if (s) Object.assign(epForm, { tone: s.tone, pageCount: s.pageCount })
})
watch(() => auth.workspace?.defaults.narrator, n => n && (epForm.narrator = n), { immediate: true })
const creating = ref(false)
async function submitEpisode() {
  if (!epForm.seriesId) return toast.error(t.needSeries)
  const parsed = createEpisodeInput.safeParse({ ...epForm, workspaceId: auth.workspace!.id })
  if (!parsed.success) return toast.error(epForm.submissionIds.length || epForm.storyText.trim() ? ko.errors.invalidInput : t.needMaterial)
  creating.value = true
  const { workspaceId: _, ...input } = parsed.data
  const out = await run(() => createEpisode(input), t.created)
  creating.value = false
  if (out) await navigateTo({ path: '/studio', query: { episode: out.episodeId } })
}

// EPI-02·11 목록
const showArchived = ref(false)
const seriesName = (id: string) => series.value.find(s => s.id === id)?.name ?? ''
const archivedSeries = computed(() => new Set(series.value.filter(s => s.archivedAt).map(s => s.id)))
const visible = computed(() => episodes.value.filter(e => (!seriesFilter.value || e.seriesId === seriesFilter.value) && (showArchived.value || (!e.archivedAt && (!archivedSeries.value.has(e.seriesId) || e.seriesId === seriesFilter.value)))))
// EPI-01 정렬: 기본은 작품별 회차 오름차순
type SortKey = 'number' | 'series' | 'stage' | 'pages' | 'cost' | 'updated'
const sortKey = ref<SortKey>('number')
const sortAsc = ref(true)
function sortBy(k: SortKey) {
  if (sortKey.value === k) sortAsc.value = !sortAsc.value
  else { sortKey.value = k; sortAsc.value = k !== 'updated' && k !== 'cost' }
}
const byNumber = (a: Episode, b: Episode) => seriesName(a.seriesId).localeCompare(seriesName(b.seriesId), 'ko') || a.number - b.number
const sorters: Record<SortKey, (a: Episode, b: Episode) => number> = {
  number: byNumber,
  series: byNumber,
  stage: (a, b) => EPISODE_STAGES.indexOf(stageOf(a)) - EPISODE_STAGES.indexOf(stageOf(b)),
  pages: (a, b) => a.settings.pageCount - b.settings.pageCount,
  cost: (a, b) => (a.costKrw ?? 0) - (b.costKrw ?? 0),
  updated: (a, b) => (a.updatedAt?.toMillis() ?? 0) - (b.updatedAt?.toMillis() ?? 0),
}
const shown = computed(() => [...visible.value].sort((a, b) => (sortAsc.value ? 1 : -1) * (sorters[sortKey.value](a, b) || byNumber(a, b))))
const dupFor = ref<{ id: string, top: number, right: number } | null>(null)
function openDup(e: Episode, ev: MouseEvent) {
  if (dupFor.value?.id === e.id) return (dupFor.value = null)
  const r = (ev.currentTarget as HTMLElement).getBoundingClientRect()
  dupFor.value = { id: e.id, top: r.bottom + 4, right: window.innerWidth - r.right }
}
useEventListener(window, 'scroll', () => (dupFor.value = null), { capture: true, passive: true })
// STO-16 같은 썰에서 나눈 화는 한 묶음으로
const groupKey = (e: Episode) => (e.materialPart ? `${e.seriesId}|${[...e.submissionIds].sort().join(',')}|${e.materialPart.total}` : null)
interface TableRow { key: string, group?: { title: string, total: number, submissionId?: string }, e?: Episode, inGroup?: boolean }
const tableRows = computed(() => {
  const out: TableRow[] = []
  const done = new Set<string>()
  for (const e of shown.value) {
    const g = groupKey(e)
    if (!g) { out.push({ key: e.id, e }); continue }
    if (done.has(g)) continue
    done.add(g)
    const members = shown.value.filter(x => groupKey(x) === g).sort((a, b) => a.materialPart!.index - b.materialPart!.index)
    const sub = submissions.value.find(s => s.id === e.submissionIds[0])
    out.push({ key: `g-${g}`, group: { title: sub?.title || t.splitGroupFallback, total: e.materialPart!.total, submissionId: sub?.id } })
    for (const m of members) out.push({ key: m.id, e: m, inGroup: true })
  }
  return out
})
useEventListener(document, 'click', () => (dupFor.value = null))
const cols: { key: SortKey, label: string }[] = [
  { key: 'number', label: t.col.title },
  { key: 'series', label: t.col.series },
  { key: 'stage', label: t.col.stage },
  { key: 'pages', label: t.col.pages },
  { key: 'cost', label: t.col.cost },
  { key: 'updated', label: t.col.updated },
]
const shownSeries = computed(() => series.value.filter(s => showArchived.value || !s.archivedAt || s.id === seriesFilter.value))
const toggleSeriesArchive = (id: string, archived: boolean) => run(() => updateSeries(id, { archivedAt: archived ? null : serverTimestamp() }))
// EPI-15 회차 번호 · EPI-14 복제
function setNumber(e: Episode, v: string) {
  const n = Number(v)
  if (Number.isInteger(n) && n >= 1 && n <= 9999 && n !== e.number) run(() => updateEpisode(e.id, { number: n }))
}
function dup(e: Episode, mode: string) {
  if (mode === 'structure' || mode === 'full') return run(() => duplicate(e.id, mode), t.duplicated)
}
const liveCount = (id: string) => episodes.value.filter(e => e.seriesId === id).length
const krw = (n: number) => `₩${(n ?? 0).toLocaleString('ko-KR')}`
const date = (e: Episode) => (e.updatedAt ? new Date(e.updatedAt.toMillis()).toLocaleDateString('ko-KR') : '')

// EPI-12 상태 · EPI-16 삭제
const setStage = (e: Episode, stage: EpisodeStage) => run(() => updateEpisode(e.id, stagePatch(stage)))
const toggleArchive = (e: Episode) => run(() => updateEpisode(e.id, { archivedAt: e.archivedAt ? null : serverTimestamp() }))
async function remove(e: Episode) {
  if (!await confirmDialog(t.confirmDelete(e.title))) return
  if (e.status === 'published' && !await confirmDialog(t.confirmPublished)) return
  return run(() => trash('episode', e.id), t.deleted)
}
async function removeSeries(id: string) {
  const s = series.value.find(x => x.id === id)
  if (!s || !await confirmDialog(t.confirmDelete(s.name))) return
  return run(async () => {
    await trash('series', id)
    seriesFilter.value = ''
  }, t.deleted)
}
</script>

<template>
  <div class="flex flex-col gap-6 p-8">
    <div class="flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold">
        Stories <span class="text-muted-foreground text-base font-normal">· 작품</span>
      </h1>
      <div v-if="edit" class="flex gap-2">
        <Button variant="outline" @click="seriesOpen = !seriesOpen">
          <Plus class="size-4" /> {{ t.newSeries }}
        </Button>
        <Button @click="epOpen = !epOpen">
          <Plus class="size-4" /> {{ t.newEpisode }}
        </Button>
      </div>
    </div>

    <Card v-if="seriesOpen && edit">
      <CardHeader>
        <CardTitle>{{ t.newSeries }}</CardTitle>
      </CardHeader>
      <CardContent>
        <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="submitSeries">
          <div class="flex flex-col gap-1.5">
            <Label for="s-name">{{ t.seriesName }}</Label>
            <Input id="s-name" v-model="seriesForm.name" maxlength="40" required />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="s-intro">{{ t.seriesIntro }}</Label>
            <Input id="s-intro" v-model="seriesForm.intro" maxlength="100" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="s-tone">{{ t.tone }}</Label>
            <AppSelect id="s-tone" v-model="seriesForm.tone" :class="selectClass">
              <option v-for="tone in TONES" :key="tone" :value="tone">
                {{ t.tones[tone] }}
              </option>
            </AppSelect>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="s-pages">{{ t.pageCount }}</Label>
            <Input id="s-pages" v-model.number="seriesForm.pageCount" type="number" min="1" max="20" />
          </div>
          <div class="flex gap-2 sm:col-span-2">
            <Button type="submit">
              {{ t.create }}
            </Button>
            <Button type="button" variant="ghost" @click="seriesOpen = false">
              {{ t.cancel }}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    <Card v-if="epOpen && edit">
      <CardHeader>
        <CardTitle>{{ t.newEpisode }}</CardTitle>
        <CardDescription v-if="series.length === 0">
          {{ t.needSeries }}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-3" @submit.prevent="submitEpisode">
          <div class="grid gap-3 sm:grid-cols-5">
            <div class="flex flex-col gap-1.5 sm:col-span-2">
              <Label for="e-series">{{ t.series }}</Label>
              <AppSelect id="e-series" v-model="epForm.seriesId" :class="selectClass" required>
                <option v-for="s in series" :key="s.id" :value="s.id">
                  {{ s.name }}
                </option>
              </AppSelect>
            </div>
            <div class="flex flex-col gap-1.5 sm:col-span-3">
              <Label for="e-title">{{ t.title }}</Label>
              <Input id="e-title" v-model="epForm.title" maxlength="80" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="e-tone">{{ t.tone }}</Label>
              <AppSelect id="e-tone" v-model="epForm.tone" :class="selectClass">
                <option v-for="tone in TONES" :key="tone" :value="tone">
                  {{ t.tones[tone] }}
                </option>
              </AppSelect>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="e-pages">{{ t.pageCount }}</Label>
              <Input id="e-pages" v-model.number="epForm.pageCount" type="number" min="1" max="20" />
            </div>
            <div class="flex flex-col gap-1.5 sm:col-span-3">
              <Label for="e-narrator">{{ t.narrator }}</Label>
              <AppSelect id="e-narrator" v-model="epForm.narrator" :class="selectClass">
                <option v-for="n in ['first', 'third'] as const" :key="n" :value="n">
                  {{ t.narrators[n] }}
                </option>
              </AppSelect>
            </div>
          </div>
          <fieldset class="flex flex-col gap-1.5">
            <legend class="mb-1.5 text-sm font-medium">
              {{ t.material }} · {{ t.pickAccepted }}
            </legend>
            <p v-if="usable.length === 0" class="text-muted-foreground text-sm">
              {{ t.noAccepted }}
            </p>
            <label v-for="s in usable" :key="s.id" class="flex items-start gap-2 text-sm">
              <AppCheck v-model="epForm.submissionIds" :value="s.id" class="mt-1" />
              <span><span class="font-medium">{{ s.title }}</span> <span class="text-muted-foreground line-clamp-1">{{ s.body }}</span></span>
            </label>
          </fieldset>
          <div class="flex flex-col gap-1.5">
            <Label for="e-text">{{ t.storyText }}</Label>
            <Textarea id="e-text" v-model="epForm.storyText" rows="4" />
          </div>
          <div class="flex gap-2">
            <Button type="submit" :disabled="creating || series.length === 0">
              {{ t.create }}
            </Button>
            <Button type="button" variant="ghost" @click="epOpen = false">
              {{ t.cancel }}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    <AppListSkeleton v-if="loading" />
    <AppEmptyState v-else-if="series.length === 0" :icon="BookOpen" :title="ko.empty.stories.title" :body="ko.empty.stories.body" />

    <template v-else>
      <div class="flex flex-wrap gap-3">
        <button
          class="rounded-lg border px-4 py-3 text-left" :class="seriesFilter === '' ? 'border-primary bg-card' : 'bg-card/60'"
          @click="seriesFilter = ''"
        >
          <div class="font-medium">
            {{ t.allSeries }}
          </div>
          <div class="text-muted-foreground text-xs">
            {{ t.episodes(episodes.length) }}
          </div>
        </button>
        <div
          v-for="s in shownSeries" :key="s.id" class="group relative rounded-lg border px-4 py-3 text-left" :class="seriesFilter === s.id ? 'border-primary bg-card' : 'bg-card/60'"
        >
          <button class="text-left" @click="seriesFilter = s.id">
            <div class="font-medium">{{ s.name }}</div>
            <div class="text-muted-foreground text-xs">{{ s.intro || t.tones[s.tone] }} · {{ t.episodes(liveCount(s.id)) }}</div>
          </button>
          <button v-if="edit && seriesFilter === s.id" class="text-muted-foreground mt-1 block text-xs hover:underline" @click="toggleSeriesArchive(s.id, !!s.archivedAt)">
            {{ s.archivedAt ? t.unarchiveSeries : t.archiveSeries }}
          </button>
          <button
            v-if="edit && liveCount(s.id) === 0" class="text-muted-foreground absolute top-1 right-1 hidden group-hover:block" :aria-label="t.delete"
            @click="removeSeries(s.id)"
          >
            <Trash2 class="size-3.5" />
          </button>
        </div>
      </div>

      <section v-if="edit && current && setup.includes(false) && !hideSetup.includes(current.id)" class="bg-card flex flex-col gap-3 rounded-lg border p-4">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold">{{ t.setup.title(current.name) }}</h2>
          <button class="text-muted-foreground text-xs hover:underline" @click="hideSetup = [...hideSetup, current.id]">{{ t.setup.hide }}</button>
        </div>
        <p class="text-muted-foreground text-xs">{{ t.setup.body }}</p>
        <ol class="flex flex-col gap-2 text-sm">
          <li class="flex flex-wrap items-center gap-2">
            <span :class="dot(setup[0]!)">{{ setup[0] ? '✓' : 1 }}</span>
            <span class="w-24">{{ t.setup.style }}</span>
            <AppSelect :model-value="current.styleId ?? ''" :class="selectClass" :aria-label="t.setup.style" @update:model-value="setStyle">
              <option value="">{{ t.setup.noStyle }}</option>
              <option v-for="s in liveStyles" :key="s.id" :value="s.id">{{ s.name }}</option>
            </AppSelect>
            <NuxtLink to="/styles" class="text-muted-foreground text-xs underline">{{ t.setup.newStyle }}</NuxtLink>
          </li>
          <li class="flex flex-wrap items-center gap-2">
            <span :class="dot(setup[1]!)">{{ setup[1] ? '✓' : 2 }}</span>
            <span class="w-24">{{ t.setup.characters }}</span>
            <span class="text-muted-foreground">{{ mainChars.map(c => c.name).join(', ') || t.setup.noCharacters }}</span>
            <NuxtLink to="/characters" class="text-muted-foreground text-xs underline">{{ t.setup.pickCharacters }}</NuxtLink>
          </li>
          <li class="flex flex-wrap items-center gap-2">
            <span :class="dot(setup[2]!)">{{ setup[2] ? '✓' : 3 }}</span>
            <span class="w-24">{{ t.setup.episode }}</span>
            <Button size="sm" variant="outline" @click="epOpen = true">{{ t.setup.firstEpisode }}</Button>
          </li>
        </ol>
      </section>

      <div class="flex items-center gap-2 text-sm">
        <label class="flex items-center gap-1.5"><AppCheck v-model="showArchived" /> {{ t.showArchived }}</label>
      </div>

      <div class="overflow-x-auto rounded-lg border">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-muted-foreground text-left">
            <tr>
              <th v-for="c in cols" :key="c.key" class="px-3 py-2 font-medium" :aria-sort="sortKey === c.key ? (sortAsc ? 'ascending' : 'descending') : 'none'">
                <button type="button" class="hover:text-foreground inline-flex items-center gap-1" :class="{ 'text-foreground': sortKey === c.key }" @click="sortBy(c.key)">
                  {{ c.label }}
                  <component :is="sortKey === c.key ? (sortAsc ? ArrowUp : ArrowDown) : ArrowUpDown" class="size-3" :class="{ 'opacity-40': sortKey !== c.key }" />
                </button>
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-if="shown.length === 0">
              <td colspan="7" class="text-muted-foreground px-3 py-8 text-center">{{ t.empty }}</td>
            </tr>
            <template v-for="{ key, group, e, inGroup } in tableRows" :key="key">
            <tr v-if="group" class="bg-muted/30 border-t">
              <td colspan="7" class="px-3 py-1.5 text-xs">
                <span class="inline-flex items-center gap-1.5">
                  <FileText class="text-muted-foreground size-3.5" />
                  <NuxtLink v-if="group.submissionId" :to="{ path: '/inbox', query: { id: group.submissionId } }" class="font-medium hover:underline">{{ group.title }}</NuxtLink>
                  <span v-else class="font-medium">{{ group.title }}</span>
                  <span class="text-muted-foreground">· {{ t.splitGroup(group.total) }}</span>
                </span>
              </td>
            </tr>
            <tr v-else-if="e" class="border-t" :class="{ 'opacity-60': e.archivedAt, 'border-t-0': inGroup }">
              <td class="py-2 pr-3" :class="inGroup ? 'border-primary/40 border-l-2 pl-5' : 'pl-3'">
                <input
                  v-if="edit" :value="e.number" type="number" min="1" max="9999" :aria-label="t.numberLabel"
                  class="mr-2 w-12 rounded border px-1 text-xs" @change="setNumber(e, ($event.target as HTMLInputElement).value)"
                >
                <NuxtLink :to="{ path: '/studio', query: { episode: e.id } }" class="font-medium hover:underline">{{ e.title }}</NuxtLink>
                <span v-if="e.materialPart" class="text-muted-foreground ml-1.5 text-xs">{{ ko.studio.split.partOf(e.materialPart.total, e.materialPart.index) }}</span>
              </td>
              <td class="px-3 py-2">{{ seriesName(e.seriesId) }}</td>
              <td class="px-3 py-2">
                <AppSelect
                  :value="stageOf(e)" :class="selectClass" :disabled="!edit" :aria-label="t.col.stage"
                  @change="setStage(e, $event as EpisodeStage)"
                >
                  <option v-for="st in EPISODE_STAGES" :key="st" :value="st">
                    {{ t.stages[st] }}
                  </option>
                </AppSelect>
              </td>
              <td class="px-3 py-2">{{ t.pages(e.settings.pageCount) }}</td>
              <td class="px-3 py-2">{{ krw(e.costKrw) }}</td>
              <td class="text-muted-foreground px-3 py-2">{{ date(e) }}</td>
              <td class="px-3 py-2 text-right whitespace-nowrap">
                <div v-if="edit" class="flex items-center justify-end gap-1">
                  <div class="relative">
                    <Button size="icon" variant="ghost" class="size-8" :aria-label="t.duplicate" :title="t.duplicateHint" :aria-expanded="dupFor?.id === e.id" @click.stop="openDup(e, $event)">
                      <Copy class="size-4" />
                    </Button>
                    <div v-if="dupFor?.id === e.id" role="menu" class="bg-popover fixed z-50 flex w-32 flex-col rounded-md border p-1 text-left text-sm shadow-md" :style="{ top: `${dupFor.top}px`, right: `${dupFor.right}px` }" @click.stop>
                      <button v-for="m in (['structure', 'full'] as const)" :key="m" type="button" role="menuitem" class="hover:bg-accent rounded px-2 py-1.5 text-left" @click="dupFor = null; dup(e, m)">
                        {{ t.duplicateModes[m] }}
                      </button>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" class="size-8" :aria-label="e.archivedAt ? t.unarchive : t.archive" :title="e.archivedAt ? t.unarchive : t.archive" @click="toggleArchive(e)">
                    <component :is="e.archivedAt ? ArchiveRestore : Archive" class="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" class="text-destructive size-8" :aria-label="t.delete" :title="t.delete" @click="remove(e)">
                    <Trash2 class="size-4" />
                  </Button>
                </div>
              </td>
            </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
