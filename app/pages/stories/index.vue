<script setup lang="ts">
import type { Episode, EpisodeStage, Tone } from '#shared/episodes'
import { BookOpen, Plus, Trash2 } from '@lucide/vue'
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
watch(series, (list) => {
  if (!epForm.seriesId && list[0]) epForm.seriesId = list[0].id
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
const seriesFilter = ref('')
const showArchived = ref(false)
const seriesName = (id: string) => series.value.find(s => s.id === id)?.name ?? ''
const archivedSeries = computed(() => new Set(series.value.filter(s => s.archivedAt).map(s => s.id)))
const shown = computed(() => episodes.value.filter(e => (!seriesFilter.value || e.seriesId === seriesFilter.value) && (showArchived.value || (!e.archivedAt && (!archivedSeries.value.has(e.seriesId) || e.seriesId === seriesFilter.value)))))
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
            <select id="s-tone" v-model="seriesForm.tone" :class="selectClass">
              <option v-for="tone in TONES" :key="tone" :value="tone">
                {{ t.tones[tone] }}
              </option>
            </select>
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
              <select id="e-series" v-model="epForm.seriesId" :class="selectClass" required>
                <option v-for="s in series" :key="s.id" :value="s.id">
                  {{ s.name }}
                </option>
              </select>
            </div>
            <div class="flex flex-col gap-1.5 sm:col-span-3">
              <Label for="e-title">{{ t.title }}</Label>
              <Input id="e-title" v-model="epForm.title" maxlength="80" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="e-tone">{{ t.tone }}</Label>
              <select id="e-tone" v-model="epForm.tone" :class="selectClass">
                <option v-for="tone in TONES" :key="tone" :value="tone">
                  {{ t.tones[tone] }}
                </option>
              </select>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="e-pages">{{ t.pageCount }}</Label>
              <Input id="e-pages" v-model.number="epForm.pageCount" type="number" min="1" max="20" />
            </div>
            <div class="flex flex-col gap-1.5 sm:col-span-3">
              <Label for="e-narrator">{{ t.narrator }}</Label>
              <select id="e-narrator" v-model="epForm.narrator" :class="selectClass">
                <option v-for="n in ['first', 'third'] as const" :key="n" :value="n">
                  {{ t.narrators[n] }}
                </option>
              </select>
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
              <input v-model="epForm.submissionIds" type="checkbox" :value="s.id" class="mt-1">
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

      <div class="flex items-center gap-2 text-sm">
        <label class="flex items-center gap-1.5"><input v-model="showArchived" type="checkbox"> {{ t.showArchived }}</label>
      </div>

      <div class="overflow-x-auto rounded-lg border">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-muted-foreground text-left">
            <tr>
              <th class="px-3 py-2 font-medium">{{ t.col.title }}</th>
              <th class="px-3 py-2 font-medium">{{ t.col.series }}</th>
              <th class="px-3 py-2 font-medium">{{ t.col.stage }}</th>
              <th class="px-3 py-2 font-medium">{{ t.col.pages }}</th>
              <th class="px-3 py-2 font-medium">{{ t.col.cost }}</th>
              <th class="px-3 py-2 font-medium">{{ t.col.updated }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-if="shown.length === 0">
              <td colspan="7" class="text-muted-foreground px-3 py-8 text-center">{{ t.empty }}</td>
            </tr>
            <tr v-for="e in shown" :key="e.id" class="border-t" :class="{ 'opacity-60': e.archivedAt }">
              <td class="px-3 py-2">
                <input
                  v-if="edit" :value="e.number" type="number" min="1" max="9999" :aria-label="t.numberLabel"
                  class="mr-2 w-12 rounded border px-1 text-xs" @change="setNumber(e, ($event.target as HTMLInputElement).value)"
                >
                <NuxtLink :to="{ path: '/studio', query: { episode: e.id } }" class="font-medium hover:underline">{{ e.title }}</NuxtLink>
              </td>
              <td class="px-3 py-2">{{ seriesName(e.seriesId) }}</td>
              <td class="px-3 py-2">
                <select
                  :value="stageOf(e)" :class="selectClass" :disabled="!edit" :aria-label="t.col.stage"
                  @change="setStage(e, ($event.target as HTMLSelectElement).value as EpisodeStage)"
                >
                  <option v-for="st in EPISODE_STAGES" :key="st" :value="st">
                    {{ t.stages[st] }}
                  </option>
                </select>
              </td>
              <td class="px-3 py-2">{{ t.pages(e.settings.pageCount) }}</td>
              <td class="px-3 py-2">{{ krw(e.costKrw) }}</td>
              <td class="text-muted-foreground px-3 py-2">{{ date(e) }}</td>
              <td class="px-3 py-2 text-right whitespace-nowrap">
                <template v-if="edit">
                  <select :class="selectClass" :aria-label="t.duplicate" :title="t.duplicateHint" value="" @change="dup(e, ($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
                    <option value="" disabled>{{ t.duplicate }}</option>
                    <option v-for="m in (['structure', 'full'] as const)" :key="m" :value="m">{{ t.duplicateModes[m] }}</option>
                  </select>
                  <Button size="sm" variant="ghost" @click="toggleArchive(e)">
                    {{ e.archivedAt ? t.unarchive : t.archive }}
                  </Button>
                  <Button size="sm" variant="ghost" :aria-label="t.delete" @click="remove(e)">
                    <Trash2 class="size-4" />
                  </Button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
