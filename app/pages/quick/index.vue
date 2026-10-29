<script setup lang="ts">
import type { QuickAnswers, QuickDirection, QuickFormat, QuickShape, LineLength } from '#shared/quick'
import type { StoryIdea } from '#shared/story'
import { ChevronLeft, Loader2, Play, RefreshCw, Sparkles } from '@lucide/vue'
import { useLocalStorage } from '@vueuse/core'
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { toast } from 'vue-sonner'
import { DIRECTION_TONE, QUICK_CUT_SECS, QUICK_PAGES, QUICK_TOTAL_SECS, defaultAnswers, defaultLineLength, pageCountOf } from '#shared/quick'
import { canEdit } from '#shared/roles'
import { ideasSchema, parseJson, topicsSchema } from '#shared/story'
import { callFn } from '~/lib/functions'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

// Quick 빠른 제작: 예시 질문 카드(QCK-10~20) → 진행·완성(QuickRun)
const t = ko.quick
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { $firestore, $functions } = useNuxtApp()
const edit = computed(() => canEdit(auth.role))
const episodeId = computed(() => String(route.query.episode ?? ''))

const STEPS = ['format', 'video', 'style', 'shape', 'direction', 'lines', 'story', 'confirm'] as const
type QStep = typeof STEPS[number]
const last = useLocalStorage<QuickAnswers>('toonflow:quick:last', defaultAnswers(), { mergeDefaults: true })
const hasLast = useLocalStorage('toonflow:quick:hasLast', false)
const a = reactive<QuickAnswers>({ ...defaultAnswers(), ...last.value })
const recent = useLocalStorage<{ id: string, title: string }[]>('toonflow:quick:recent', [])
const fromSub = String(route.query.submission ?? '')
// QCK-34 같은 설정으로: 썰부터
const step = ref(route.query.again ? STEPS.indexOf('story') : 0)
const cur = computed<QStep>(() => STEPS[step.value]!)
const go = (d: number) => (step.value = Math.min(STEPS.length - 1, Math.max(0, step.value + d)))
const next = () => go(1)

const lib = useLibrary()
const { series, createSeries, createEpisode } = useStories()
const subs = useSubmissions()
const currentSeries = useSeriesFilter(series)
const seriesId = ref('')
watch(currentSeries, v => (seriesId.value ||= v), { immediate: true })
const liveSeries = computed(() => series.value.filter(x => !x.archivedAt))
const mainChars = computed(() => series.value.find(x => x.id === seriesId.value)?.mainCharacterIds?.length ?? 0)
const styles = computed(() => lib.styles.value.filter(x => !x.archivedAt))

function pick<K extends keyof QuickAnswers>(k: K, v: QuickAnswers[K], advance = true) {
  a[k] = v
  if (k === 'format') a.lineLength = defaultLineLength(v as QuickFormat)
  if (advance) next()
}

// QCK-17 썰
const mode = ref<'paste' | 'inbox' | 'ai'>(fromSub ? 'inbox' : 'paste')
const text = ref('')
const subId = ref(fromSub)
const usable = computed(() => subs.list.value.filter(x => ['new', 'reviewing', 'accepted', 'used'].includes(x.status)))
const sub = computed(() => subs.list.value.find(x => x.id === subId.value) ?? null)
// QCK-18 썰 만들기
const topics = ref<{ tag: string, hints: string[] }[]>([])
const topic = ref('')
const hint = ref('')
const ideas = ref<StoryIdea[]>([])
const chosen = ref(-1)
const open = ref(-1)
const reviseAt = ref(-1)
const reviseReq = ref('')
const ideaJobId = ref<string | null>(null)
const ideaMode = ref<'topics' | 'ideas' | 'revise'>('topics')
const ideaJob = lib.watchJob(ideaJobId)
const ideaBusy = computed(() => !!ideaJobId.value && (!ideaJob.value || ['queued', 'running'].includes(ideaJob.value.status)))
const idea = computed(() => ideas.value[chosen.value] ?? null)
const material = computed(() => (mode.value === 'inbox' ? (sub.value?.maskedBody || sub.value?.body || '') : mode.value === 'ai' ? (idea.value?.body ?? '') : text.value).trim())
const label = (k: string, v: string) => ((t as unknown as Record<string, Record<string, string>>)[k]?.[v] ?? v)
const context = () => [`형식: ${label('format', a.format)}`, `등장인물: ${label('shape', a.shape)}`, `이야기: ${label('direction', a.direction)}`].join(', ')
async function askIdeas(m: 'topics' | 'ideas' | 'revise', base?: StoryIdea) {
  ideaMode.value = m
  try {
    const out = await callFn($functions, 'startAiJob', {
      workspaceId: auth.workspace!.id,
      type: 'story.ideas',
      target: {},
      params: { mode: m, topic: topic.value, hint: hint.value, context: context(), ...(base ? { base: { title: base.title, body: base.body }, request: reviseReq.value } : {}) },
      idempotencyKey: crypto.randomUUID(),
    })
    ideaJobId.value = out.jobId
  }
  catch (e) {
    toast.error(errorMessage(e) ?? ko.errors.unknown)
  }
}
watch(ideaJob, (j) => {
  if (!j || ['queued', 'running'].includes(j.status)) return
  const raw = String(j.providerResult ?? '')
  ideaJobId.value = null
  if (j.status !== 'succeeded') return void toast.error(t.story.failed)
  if (ideaMode.value === 'topics') {
    topics.value = parseJson(topicsSchema, raw)?.topics ?? []
    return
  }
  const out = parseJson(ideasSchema, raw)?.ideas
  if (!out?.length) return void toast.error(t.story.failed)
  if (ideaMode.value === 'revise' && reviseAt.value >= 0) {
    ideas.value = ideas.value.map((x, i) => (i === reviseAt.value ? out[0]! : x))
    chosen.value = reviseAt.value
    reviseAt.value = -1
    reviseReq.value = ''
  }
  else {
    ideas.value = out
    chosen.value = 0
  }
})
watch([cur, mode], ([c, m]) => {
  if (c === 'story' && m === 'ai' && !topics.value.length && !ideaBusy.value) void askIdeas('topics')
})
const hintsOf = computed(() => topics.value.find(x => x.tag === topic.value)?.hints ?? [])

// QCK-20 확인
const pageCount = computed(() => pageCountOf(a, material.value.length))
const cutGuess = computed(() => (pageCount.value === 1 ? 6 : Math.ceil(pageCount.value * 1.5)))
const estimate = computed(() => lib.estimateText('story.draft', material.value.length) + lib.estimateText('storyboard.split', material.value.length * 2) + lib.estimate(cutGuess.value))
const krw = (n: number) => `₩${n.toLocaleString('ko-KR')}`
const summary = computed(() => [
  { k: 'format', v: a.format === 'multi' ? `${t.format.multi} ${t.format.pages(a.pages)}` : label('format', a.format) },
  { k: 'video', v: a.video ? `${t.video.yes} · ${a.totalSec ? t.video.sec(a.totalSec) : `${t.video.perCut} ${t.video.sec(a.cutSec ?? 3)}`}` : t.video.no },
  { k: 'style', v: styles.value.find(x => x.id === a.styleId)?.name ?? t.style.none },
  { k: 'shape', v: label('shape', a.shape) },
  { k: 'direction', v: label('direction', a.direction) },
  { k: 'lines', v: label('lines', a.lineLength) },
  { k: 'story', v: material.value ? `${(mode.value === 'ai' ? idea.value?.title : mode.value === 'inbox' ? sub.value?.title : material.value.split('\n')[0])?.slice(0, 30) ?? ''}` : '-' },
])
const creating = ref(false)
async function make() {
  if (creating.value || !material.value) return
  creating.value = true
  try {
    const tone = DIRECTION_TONE[a.direction]
    const sid = seriesId.value || (await createSeries({ name: t.seriesName, intro: t.seriesIntro, tone, pageCount: pageCount.value })).id
    if (mode.value === 'inbox' && sub.value && !['accepted', 'used'].includes(sub.value.status)) await subs.setStatus([sub.value.id], 'accepted')
    const ai = mode.value === 'ai' && idea.value
    const { episodeId: id } = await createEpisode({
      seriesId: sid,
      title: ai ? idea.value!.title.slice(0, 80) : '',
      submissionIds: mode.value === 'inbox' && sub.value ? [sub.value.id] : [],
      storyText: mode.value === 'inbox' ? '' : material.value,
      tone,
      pageCount: pageCount.value,
      narrator: 'first',
      ...(ai ? { storyTitle: idea.value!.title.slice(0, 80), storyNote: t.aiNote } : {}),
    })
    const epRef = doc($firestore, 'workspaces', auth.workspace!.id, 'episodes', id)
    if (a.styleId || a.shape !== 'registered') {
      await updateDoc(epRef, { ...(a.styleId ? { 'settings.styleId': a.styleId } : {}), ...(a.shape !== 'registered' ? { 'settings.characterIds': [] } : {}), updatedAt: serverTimestamp() })
    }
    await setDoc(doc(epRef, 'meta', 'quick'), { answers: { ...a }, done: false, updatedAt: serverTimestamp() })
    last.value = { ...a }
    hasLast.value = true
    recent.value = [{ id, title: ai ? idea.value!.title : material.value.split('\n')[0]!.slice(0, 30) }, ...recent.value.filter(x => x.id !== id)].slice(0, 5)
    currentSeries.value = sid
    await router.replace({ query: { episode: id } })
  }
  catch (e) {
    toast.error(errorMessage(e) ?? ko.errors.unknown)
  }
  finally {
    creating.value = false
  }
}
const lastLabel = computed(() => (step.value === 0 && hasLast.value ? t.again(summary.value.slice(0, 2).map(x => x.v).join(' · ')) : ''))
const canNext = computed(() => cur.value !== 'story' || !!material.value)
const LINE_KEYS: LineLength[] = ['short', 'normal', 'long']
const SHAPES: QuickShape[] = ['human', 'animal', 'object', 'stick', 'registered']
const DIRS: QuickDirection[] = ['twist', 'emotion', 'faithful', 'verbatim']
</script>

<template>
  <QuickRun v-if="episodeId" :key="episodeId" :episode-id="episodeId" />
  <div v-else class="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 p-4 pb-0">
    <div class="flex items-center justify-between text-sm">
      <button type="button" class="text-muted-foreground flex items-center gap-0.5 disabled:opacity-40" :disabled="step === 0" @click="go(-1)"><ChevronLeft class="size-4" />{{ t.prev }}</button>
      <div class="flex gap-1" :aria-label="t.stepOf(step + 1, STEPS.length)">
        <span v-for="(_, i) in STEPS" :key="i" class="h-1 w-5 rounded-full" :class="i <= step ? 'bg-primary' : 'bg-muted'" />
      </div>
      <button type="button" class="text-muted-foreground disabled:opacity-40" :disabled="cur === 'story' || cur === 'confirm'" @click="next">{{ t.skip }}</button>
    </div>

    <div v-if="step === 0 && recent.length" class="flex flex-wrap items-center gap-1.5 text-xs">
      <span class="text-muted-foreground">{{ t.resume }}</span>
      <NuxtLink v-for="r in recent" :key="r.id" :to="{ query: { episode: r.id } }" class="bg-muted rounded-full px-2.5 py-1 hover:underline">{{ r.title || r.id }}</NuxtLink>
    </div>

    <p v-if="!edit" class="text-muted-foreground text-sm">{{ ko.forbidden.title }}</p>

    <!-- ① 형식 -->
    <template v-else-if="cur === 'format'">
      <h1 class="text-xl font-bold">{{ t.format.title }}</h1>
      <p class="text-muted-foreground -mt-2 text-xs">{{ t.format.sub }}</p>
      <div class="grid grid-cols-2 gap-2.5">
        <QuickOption :label="t.format.one" :sub="t.format.oneSub" :selected="a.format === 'one'" @pick="pick('format', 'one')">
          <svg width="56" height="70" viewBox="0 0 56 70" aria-hidden="true"><rect x="1" y="1" width="54" height="68" rx="3" fill="#fff" stroke="currentColor" /><rect x="5" y="5" width="46" height="8" fill="currentColor" /><rect x="5" y="16" width="14" height="14" class="fill-primary/30" /><rect x="21" y="16" width="14" height="14" class="fill-primary/30" /><rect x="37" y="16" width="14" height="14" class="fill-primary/30" /><rect x="5" y="33" width="22" height="14" class="fill-primary/30" /><rect x="29" y="33" width="22" height="14" class="fill-primary/30" /><rect x="5" y="50" width="46" height="15" class="fill-primary" /></svg>
        </QuickOption>
        <QuickOption :label="t.format.multi" :sub="t.format.multiSub" :selected="a.format === 'multi'" @pick="pick('format', 'multi', false)">
          <svg width="80" height="70" viewBox="0 0 80 70" aria-hidden="true"><g fill="#fff" stroke="currentColor"><rect x="22" y="1" width="40" height="52" rx="3" /><rect x="14" y="8" width="40" height="52" rx="3" /><rect x="6" y="15" width="40" height="52" rx="3" /></g><rect x="10" y="19" width="32" height="20" class="fill-primary/30" /><rect x="10" y="42" width="32" height="21" class="fill-primary/30" /></svg>
        </QuickOption>
        <QuickOption :label="t.format.auto" :sub="t.format.autoSub" :selected="a.format === 'auto'" @pick="pick('format', 'auto')">
          <Sparkles class="text-primary size-8" />
        </QuickOption>
      </div>
      <div v-if="a.format === 'multi'" class="flex gap-2">
        <Button v-for="n in QUICK_PAGES" :key="n" class="h-11 flex-1" :variant="a.pages === n ? 'default' : 'outline'" @click="a.pages = n; next()">{{ t.format.pages(n) }}</Button>
      </div>
    </template>

    <!-- ② 영상 -->
    <template v-else-if="cur === 'video'">
      <h1 class="text-xl font-bold">{{ t.video.title }}</h1>
      <p class="text-muted-foreground -mt-2 text-xs">{{ t.video.sub }}</p>
      <QuickOption row :label="t.video.no" :sub="t.video.noSub" :selected="!a.video" @pick="pick('video', false)" />
      <QuickOption row :label="t.video.yes" :sub="t.video.yesSub" :selected="a.video" @pick="pick('video', true, false)">
        <Play class="text-primary size-7" />
      </QuickOption>
      <template v-if="a.video">
        <span class="text-muted-foreground mt-1 text-xs">{{ t.video.perCut }}</span>
        <div class="flex gap-2">
          <Button v-for="(sec, i) in QUICK_CUT_SECS" :key="sec" class="h-11 flex-1 rounded-full" :variant="!a.totalSec && a.cutSec === sec ? 'default' : 'outline'" @click="a.cutSec = sec; a.totalSec = null">
            {{ [t.video.fast, t.video.normal, t.video.slow][i] }} {{ t.video.sec(sec) }}
          </Button>
        </div>
        <span class="text-muted-foreground mt-1 text-xs">{{ t.video.total }}</span>
        <div class="flex gap-2">
          <Button v-for="sec in QUICK_TOTAL_SECS" :key="sec" class="h-11 flex-1 rounded-full" :variant="a.totalSec === sec ? 'default' : 'outline'" @click="a.totalSec = sec">{{ t.video.sec(sec) }}</Button>
        </div>
        <p class="text-muted-foreground text-xs">{{ t.video.example(cutGuess, a.totalSec ? a.totalSec / cutGuess : (a.cutSec ?? 3)) }}</p>
      </template>
    </template>

    <!-- ③ 그림체 -->
    <template v-else-if="cur === 'style'">
      <h1 class="text-xl font-bold">{{ t.style.title }}</h1>
      <p class="text-muted-foreground -mt-2 text-xs">{{ t.style.sub }}</p>
      <div class="grid grid-cols-2 gap-2.5">
        <QuickOption :label="t.style.none" :sub="t.style.noneSub" :selected="!a.styleId" @pick="pick('styleId', null)">
          <Sparkles class="text-primary size-8" />
        </QuickOption>
        <QuickOption v-for="st in styles" :key="st.id" :label="st.name" :sub="st.description" :selected="a.styleId === st.id" @pick="pick('styleId', st.id)">
          <AppStorageImg v-if="st.samples?.[0] || st.refImages[0]" :path="st.samples?.[0] || st.refImages[0]" :alt="st.name" class="size-full object-cover" />
          <span v-else class="text-muted-foreground text-xs">{{ st.name }}</span>
        </QuickOption>
      </div>
      <p v-if="!styles.length" class="text-muted-foreground text-xs">{{ t.style.empty }}</p>
    </template>

    <!-- ④ 등장인물 모양 -->
    <template v-else-if="cur === 'shape'">
      <h1 class="text-xl font-bold">{{ t.shape.title }}</h1>
      <p class="text-muted-foreground -mt-2 text-xs">{{ t.shape.sub }}</p>
      <div class="grid grid-cols-2 gap-2.5">
        <QuickOption
          v-for="sh in SHAPES"
          :key="sh"
          :label="label('shape', sh)"
          :sub="sh === 'registered' ? t.shape.registeredSub(mainChars) : label('shape', `${sh}Sub`) === `${sh}Sub` ? '' : label('shape', `${sh}Sub`)"
          :selected="a.shape === sh"
          :class="sh === 'registered' ? 'col-span-2' : ''"
          @pick="pick('shape', sh)"
        >
          <svg v-if="sh === 'human'" width="60" height="70" viewBox="0 0 60 70" aria-hidden="true"><circle cx="30" cy="22" r="14" fill="#ffe6cf" stroke="currentColor" /><path d="M16 20q14-16 28 0" fill="currentColor" /><rect x="16" y="38" width="28" height="30" rx="10" fill="#9fb7ff" stroke="currentColor" /></svg>
          <svg v-else-if="sh === 'animal'" width="70" height="70" viewBox="0 0 70 70" aria-hidden="true"><path d="M17 20l4-14 10 10M53 20l-4-14-10 10" fill="#fff" stroke="currentColor" /><ellipse cx="35" cy="30" rx="20" ry="17" fill="#fff" stroke="currentColor" /><circle cx="28" cy="29" r="2" fill="currentColor" /><circle cx="42" cy="29" r="2" fill="currentColor" /><ellipse cx="35" cy="58" rx="16" ry="11" fill="#fff" stroke="currentColor" /></svg>
          <svg v-else-if="sh === 'object'" width="60" height="70" viewBox="0 0 60 70" aria-hidden="true"><ellipse cx="30" cy="38" rx="20" ry="26" fill="#d9a066" stroke="currentColor" /><circle cx="23" cy="34" r="2" fill="currentColor" /><circle cx="37" cy="34" r="2" fill="currentColor" /><path d="M24 44q6 5 12 0" fill="none" stroke="currentColor" /></svg>
          <svg v-else-if="sh === 'stick'" width="50" height="70" viewBox="0 0 50 70" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="25" cy="13" r="9" /><path d="M25 22v24M25 30l-12 8M25 30l12 8M25 46l-10 18M25 46l10 18" /></svg>
          <Sparkles v-else class="text-primary size-7" />
        </QuickOption>
      </div>
    </template>

    <!-- ⑤ 이야기 방향 -->
    <template v-else-if="cur === 'direction'">
      <h1 class="text-xl font-bold">{{ t.direction.title }}</h1>
      <p class="text-muted-foreground -mt-2 text-xs">{{ t.direction.sub }}</p>
      <QuickOption v-for="d in DIRS" :key="d" row :label="label('direction', d)" :sub="label('direction', `${d}Sub`)" :selected="a.direction === d" @pick="pick('direction', d)" />
    </template>

    <!-- ⑥ 대사 길이 -->
    <template v-else-if="cur === 'lines'">
      <h1 class="text-xl font-bold">{{ t.lines.title }}</h1>
      <p class="text-muted-foreground -mt-2 text-xs">{{ t.lines.sub }}</p>
      <QuickOption v-for="l in LINE_KEYS" :key="l" row :label="label('lines', l)" :sub="label('lines', `${l}Sub`)" :selected="a.lineLength === l" @pick="pick('lineLength', l)">
        <div class="relative size-full bg-primary/15">
          <span v-for="(line, i) in t.lines.ex[l]" :key="i" class="bg-card absolute left-1 rounded-lg border border-current px-1 text-[8px] leading-tight" :style="{ top: `${4 + i * 24}px`, maxWidth: '68px' }">{{ line }}</span>
        </div>
      </QuickOption>
    </template>

    <!-- ⑦ 썰 -->
    <template v-else-if="cur === 'story'">
      <h1 class="text-xl font-bold">{{ t.story.title }}</h1>
      <div class="flex gap-1.5">
        <Button v-for="m in (['paste', 'inbox', 'ai'] as const)" :key="m" size="sm" class="h-9 flex-1 rounded-full" :variant="mode === m ? 'default' : 'outline'" @click="mode = m">{{ t.story[m] }}</Button>
      </div>
      <Textarea v-if="mode === 'paste'" v-model="text" rows="8" maxlength="20000" :placeholder="t.story.placeholder" :aria-label="t.story.paste" />
      <div v-else-if="mode === 'inbox'" class="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
        <p v-if="!usable.length" class="text-muted-foreground text-sm">{{ t.story.inboxEmpty }}</p>
        <QuickOption v-for="x in usable" :key="x.id" row :label="x.title" :sub="(x.maskedBody || x.body).slice(0, 60)" :selected="subId === x.id" @pick="subId = x.id" />
      </div>
      <div v-else class="flex flex-col gap-2.5">
        <span class="text-muted-foreground text-xs">{{ t.story.topics }}</span>
        <div class="flex flex-wrap gap-1.5">
          <Loader2 v-if="ideaBusy && ideaMode === 'topics'" class="size-4 animate-spin" />
          <Button v-for="tp in topics" :key="tp.tag" size="sm" class="rounded-full" :variant="topic === tp.tag ? 'default' : 'outline'" @click="topic = topic === tp.tag ? '' : tp.tag; hint = ''">{{ tp.tag }}</Button>
        </div>
        <template v-if="hintsOf.length">
          <span class="text-muted-foreground text-xs">{{ t.story.hints }}</span>
          <div class="flex flex-wrap gap-1.5">
            <Button v-for="h in hintsOf" :key="h" size="sm" class="h-auto rounded-full py-1.5 text-left whitespace-normal" :variant="hint === h ? 'default' : 'outline'" @click="hint = hint === h ? '' : h">{{ h }}</Button>
          </div>
        </template>
        <Input v-model="hint" maxlength="200" :placeholder="t.story.hintPlaceholder" :aria-label="t.story.hints" />
        <Button class="h-11" :disabled="ideaBusy" @click="askIdeas('ideas')">
          <Loader2 v-if="ideaBusy && ideaMode !== 'topics'" class="size-4 animate-spin" />
          {{ ideaBusy && ideaMode !== 'topics' ? t.story.making : (topic || hint ? t.story.make : t.story.auto) }} · {{ t.story.cost(lib.estimateText('story.ideas', 300)) }}
        </Button>
        <div v-for="(x, i) in ideas" :key="`${i}-${x.title}`" class="bg-card flex flex-col gap-1.5 rounded-xl border-2 p-3" :class="chosen === i ? 'border-primary' : ''">
          <span class="text-sm font-semibold">{{ x.title }}</span>
          <p v-if="open !== i" class="text-muted-foreground text-xs whitespace-pre-line">{{ x.summary.join('\n') }}</p>
          <p v-else class="text-sm whitespace-pre-line">{{ x.body }}</p>
          <div class="flex flex-wrap gap-1.5">
            <Button size="sm" class="rounded-full" :variant="chosen === i ? 'default' : 'outline'" @click="chosen = i">{{ chosen === i ? t.story.picked : t.story.pick }}</Button>
            <Button size="sm" variant="outline" class="rounded-full" @click="reviseAt = reviseAt === i ? -1 : i">{{ t.story.revise }}</Button>
            <Button size="sm" variant="ghost" class="rounded-full" @click="open = open === i ? -1 : i">{{ open === i ? t.story.less : t.story.more }}</Button>
          </div>
          <div v-if="reviseAt === i" class="flex gap-1.5">
            <Input v-model="reviseReq" maxlength="500" :placeholder="t.story.revisePlaceholder" :aria-label="t.story.revise" />
            <Button size="sm" class="h-9" :disabled="ideaBusy || !reviseReq.trim()" @click="askIdeas('revise', x)">{{ t.story.reviseRun }}</Button>
          </div>
        </div>
        <Button v-if="ideas.length" variant="outline" :disabled="ideaBusy" @click="askIdeas('ideas')"><RefreshCw class="size-4" />{{ t.story.again }}</Button>
      </div>
    </template>

    <!-- 확인 -->
    <template v-else>
      <h1 class="text-xl font-bold">{{ t.confirm.title }}</h1>
      <ul class="bg-card divide-y rounded-xl border text-sm">
        <li v-for="x in summary" :key="x.k">
          <button type="button" class="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left" @click="step = STEPS.indexOf(x.k as QStep)">
            <span class="text-muted-foreground shrink-0">{{ label('labels', x.k) }}</span>
            <span class="truncate font-medium">{{ x.v }}</span>
          </button>
        </li>
      </ul>
      <label class="flex flex-col gap-1 text-sm">
        <span class="text-muted-foreground text-xs">{{ t.confirm.series }}</span>
        <AppSelect v-model="seriesId" class="w-full">
          <option value="">{{ t.confirm.newSeries }}</option>
          <option v-for="x in liveSeries" :key="x.id" :value="x.id">{{ x.name }}</option>
        </AppSelect>
      </label>
      <p class="text-sm">{{ t.confirm.estimate }} <b>{{ krw(estimate) }}</b> <span class="text-muted-foreground text-xs">· {{ t.confirm.estimateNote }}</span></p>
    </template>

    <div v-if="edit" class="bg-background sticky bottom-0 z-20 -mx-4 mt-auto border-t p-3">
      <Button v-if="cur === 'confirm'" class="h-11 w-full" :disabled="creating || !material" @click="make">
        <Loader2 v-if="creating" class="size-4 animate-spin" />{{ creating ? t.confirm.making : t.confirm.make }}
      </Button>
      <Button v-else-if="lastLabel" class="h-11 w-full" @click="next">{{ lastLabel }} →</Button>
      <Button v-else class="h-11 w-full" :disabled="!canNext" @click="next">{{ t.next }}</Button>
    </div>
  </div>
</template>
