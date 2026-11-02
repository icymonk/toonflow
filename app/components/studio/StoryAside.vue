<script setup lang="ts">
import type { Episode } from '#shared/episodes'
import type { Character, Style } from '#shared/library'
import type { StoryVersion } from '#shared/story'
import { AlertTriangle, Loader2 } from '@lucide/vue'
import { useDebounceFn } from '@vueuse/core'
import { TONES } from '#shared/episodes'
import { ko } from '~/locales/ko'

// STO-02 설정 · STO-10 분석 · STO-14 제목 후보 · STO-24 원문
const props = defineProps<{ episode: Episode, version: StoryVersion | null, sources: { id: string, title: string, body: string }[], edit: boolean, analyzing: boolean, titling: boolean, seriesMemo: string, coverText: string, outroText: string, styles: Style[], characters: Character[], seriesStyleId: string | null, seriesMainIds: string[], extraPages?: number }>()
const emit = defineEmits<{ settings: [patch: Partial<Episode['settings']>], analyze: [], titles: [], applyTitle: [title: string], seriesMemo: [memo: string], seriesFixed: [patch: { coverText?: string, outroText?: string }], seriesStyle: [id: string | null], seriesMain: [id: string, on: boolean] }>()
const t = ko.studio.story
const selectClass = 'border-input bg-card h-9 rounded-md border px-2 text-sm disabled:opacity-50'
const extra = ref(props.episode.settings.extraRequest ?? '')
const saveExtra = useDebounceFn(() => emit('settings', { extraRequest: extra.value }), 800)
const a = computed(() => props.episode.analysis)
// EPI-04·STO-03
const memo = ref(props.seriesMemo)
watch(() => props.seriesMemo, v => (memo.value = v))
const saveMemo = useDebounceFn(() => emit('seriesMemo', memo.value.slice(0, 1000)), 800)
/** 추천 입력: 자주 쓰는 문구를 새 줄로 덧붙인다 */
const addLine = (cur: string, phrase: string, max: number) => [cur.trimEnd(), phrase].filter(Boolean).join('\n').slice(0, max)
function addExtra(phrase: string) {
  extra.value = addLine(extra.value, phrase, 500)
  saveExtra()
}
function addMemo(phrase: string) {
  memo.value = addLine(memo.value, phrase, 1000)
  saveMemo()
}
const lk = ko.studio.look
// STO-04 꼭 살릴 것 · STO-05 내 뼈대
const keepLines = computed(() => props.episode.settings.keepLines ?? [])
const toggleLine = (l: string) => emit('settings', { keepLines: keepLines.value.includes(l) ? keepLines.value.filter(x => x !== l) : [...keepLines.value, l].slice(0, 8) })
const newLine = ref('')
function addLineKeep() {
  const l = newLine.value.trim().slice(0, 300)
  if (l && !keepLines.value.includes(l)) emit('settings', { keepLines: [...keepLines.value, l].slice(0, 8) })
  newLine.value = ''
}
const lineOptions = computed(() => [...new Set([...(a.value?.quotes ?? []), ...keepLines.value])])
const outline = ref((props.episode.settings.outline ?? []).join('\n'))
const outlineLines = computed(() => outline.value.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 20))
const saveOutline = useDebounceFn(() => emit('settings', { outline: outlineLines.value.map(l => l.slice(0, 300)) }), 800)
const punch = ref(props.episode.settings.keepPunchline ?? '')
const savePunch = useDebounceFn(() => emit('settings', { keepPunchline: punch.value.slice(0, 200) }), 800)
</script>

<template>
  <section class="flex flex-col gap-2">
    <h3 class="text-sm font-semibold">
      {{ t.settings }}
    </h3>
    <div class="grid grid-cols-2 gap-2">
      <AppSelect :value="episode.settings.tone" :class="selectClass" :disabled="!edit" :aria-label="ko.stories.tone" @change="emit('settings', { tone: $event as Episode['settings']['tone'] })">
        <option v-for="tone in TONES" :key="tone" :value="tone">
          {{ ko.stories.tones[tone] }}
        </option>
      </AppSelect>
      <Input :model-value="episode.settings.pageCount" type="number" min="1" :max="20 - (extraPages ?? 0)" :disabled="!edit" :aria-label="ko.stories.pageCount" @change="emit('settings', { pageCount: Number(($event.target as HTMLInputElement).value) })" />
      <p v-if="extraPages" class="text-muted-foreground col-span-2 text-xs">{{ t.extraPages(extraPages, episode.settings.pageCount + extraPages) }}</p>
      <AppSelect :value="episode.settings.narrator" :class="[selectClass, 'col-span-2']" :disabled="!edit" :aria-label="ko.stories.narrator" @change="emit('settings', { narrator: $event as 'first' | 'third' })">
        <option v-for="n in ['first', 'third'] as const" :key="n" :value="n">
          {{ ko.stories.narrators[n] }}
        </option>
      </AppSelect>
    </div>
    <Textarea v-model="extra" :disabled="!edit" rows="2" :placeholder="t.extraRequest" :aria-label="t.extraRequest" maxlength="500" @input="saveExtra" />
    <AppSuggest v-if="edit" :label="t.extraRequest" :items="t.extraChips" @pick="addExtra" />
  </section>

  <section class="flex flex-col gap-2 border-t pt-3">
    <h3 class="text-sm font-semibold">{{ t.keep }}</h3>
    <p class="text-muted-foreground text-xs">{{ t.keepHint }}</p>
    <Label for="s-punch" class="text-xs">{{ t.keepPunchline }}</Label>
    <Input id="s-punch" v-model="punch" :disabled="!edit" maxlength="200" :placeholder="t.keepPunchlinePh" @input="savePunch" />
    <span class="text-xs">{{ t.quotes }}</span>
    <div v-if="lineOptions.length" class="flex flex-wrap gap-1.5">
      <Button v-for="l in lineOptions" :key="l" size="sm" class="h-auto rounded-full py-1 text-left text-xs whitespace-normal" :variant="keepLines.includes(l) ? 'default' : 'outline'" :aria-pressed="keepLines.includes(l)" :disabled="!edit" @click="toggleLine(l)">{{ l }}</Button>
    </div>
    <div v-if="edit" class="flex gap-1.5">
      <Input v-model="newLine" maxlength="300" :placeholder="t.keepLinePh" :aria-label="t.keepLinePh" @keydown.enter.prevent="addLineKeep" />
      <Button size="sm" variant="outline" class="h-9" :disabled="!newLine.trim()" @click="addLineKeep">{{ t.keepAdd }}</Button>
    </div>
    <Label for="s-outline" class="text-xs">{{ t.outline }}</Label>
    <Textarea id="s-outline" v-model="outline" rows="4" :disabled="!edit" :placeholder="t.outlinePh" @input="saveOutline" />
    <p class="text-muted-foreground text-xs">{{ t.outlineHint(outlineLines.length) }}</p>
  </section>

  <section class="flex flex-col gap-2 border-t pt-3">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold">
        {{ t.analysis }}
      </h3>
      <Button v-if="edit" size="sm" variant="ghost" :disabled="analyzing || !sources.length" @click="emit('analyze')">
        <Loader2 v-if="analyzing" class="size-3.5 animate-spin" /> {{ a ? t.reanalyze : t.analyze }}
      </Button>
    </div>
    <template v-if="a">
      <ul class="list-disc pl-4 text-sm">
        <li v-for="(l, i) in a.summary" :key="i">
          {{ l }}
        </li>
      </ul>
      <p v-if="a.characters.length" class="text-xs">
        <span class="text-muted-foreground">{{ t.characters }} ·</span> {{ a.characters.map(c => c.role ? `${c.name}(${c.role})` : c.name).join(', ') }}
      </p>
      <p v-if="a.points.length" class="text-xs">
        <span class="text-muted-foreground">{{ t.points }} ·</span> {{ a.points.join(' / ') }}
      </p>
      <div v-for="(w, i) in a.sensitive" :key="i" class="flex gap-1.5 rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-900">
        <AlertTriangle class="mt-0.5 size-3.5 shrink-0" /> <span><b>{{ w.text }}</b> · {{ w.reason }}</span>
      </div>
    </template>
  </section>

  <section v-if="version" class="flex flex-col gap-2 border-t pt-3">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold">
        {{ t.titles }}
      </h3>
      <Button v-if="edit" size="sm" variant="ghost" :loading="titling" @click="emit('titles')">
        <Loader2 v-if="titling" class="size-3.5 animate-spin" /> {{ t.makeTitles }}
      </Button>
    </div>
    <button
      v-for="title in version.titleCandidates" :key="title" :disabled="!edit" class="hover:bg-muted rounded px-2 py-1 text-left text-sm"
      :class="{ 'font-semibold': title === episode.title }" :title="t.applyTitle" @click="emit('applyTitle', title)"
    >
      {{ title }}
    </button>
  </section>

  <section class="flex flex-col gap-2 border-t pt-3">
    <h3 class="text-sm font-semibold">
      {{ lk.title }}
    </h3>
    <StudioLookPanel
      :episode="episode" :edit="edit" :styles="styles" :characters="characters" :series-style-id="seriesStyleId" :series-main-ids="seriesMainIds" show-style :hint="lk.hint"
      @settings="p => emit('settings', p)" @series-style="id => emit('seriesStyle', id)" @series-main="(id, on) => emit('seriesMain', id, on)"
    />
  </section>

  <section class="flex flex-col gap-2 border-t pt-3">
    <h3 class="text-sm font-semibold">{{ t.seriesMemo }}</h3>
    <Textarea v-model="memo" rows="3" class="text-xs" :placeholder="t.seriesMemoPh" :disabled="!edit" maxlength="1000" @input="saveMemo" />
    <AppSuggest v-if="edit" :label="t.seriesMemo" :items="t.memoChips" @pick="addMemo" />
    <p class="text-muted-foreground text-xs">{{ t.contextNote }}</p>
    <Label for="s-cover" class="text-xs">{{ t.coverText }}</Label>
    <Input id="s-cover" :model-value="coverText" class="h-8 text-xs" :disabled="!edit" @change="emit('seriesFixed', { coverText: ($event.target as HTMLInputElement).value.slice(0, 200) })" />
    <Label for="s-outro" class="text-xs">{{ t.outroText }}</Label>
    <Input id="s-outro" :model-value="outroText" class="h-8 text-xs" :disabled="!edit" @change="emit('seriesFixed', { outroText: ($event.target as HTMLInputElement).value.slice(0, 200) })" />
  </section>
  <section class="flex flex-col gap-2 border-t pt-3">
    <h3 class="text-sm font-semibold">
      {{ t.source }}
    </h3>
    <p v-if="!sources.length" class="text-muted-foreground text-xs">
      {{ t.noMaterial }}
    </p>
    <details v-for="s in sources" :key="s.id" open class="text-sm">
      <summary class="cursor-pointer font-medium">
        {{ s.title }}
      </summary>
      <p class="text-muted-foreground mt-1 text-xs whitespace-pre-wrap">
        {{ s.body }}
      </p>
    </details>
  </section>
</template>
