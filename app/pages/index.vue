<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { monthStats, todayTasks } from '#shared/home'
import { ko } from '~/locales/ko'

// CMN-01 이어서 하기, CMN-04 빠른 시작, CMN-05 처음 사용 안내
const t = ko.home
const auth = useAuthStore()
const { episodes, series } = useStories()
const { characters, styles } = useLibrary()
const recent = computed(() => episodes.value.filter(e => !e.archivedAt).slice(0, 5))
const seriesName = (id: string) => series.value.find(s => s.id === id)?.name ?? ''
// CMN-02 오늘 할 일 · CMN-03 이번 달 현황
const { list: subs } = useSubmissions()
const { jobs } = useNotifications()
const { usedKrw } = useUsage()
const dayAgo = Date.now() - 86_400_000
const today = computed(() => todayTasks(episodes.value, subs.value, jobs.value.filter(j => j.status === 'failed' && j.finishedAt!.toMillis() > dayAgo).length))
const todo = computed(() => [
  { n: today.value.newSubs, label: t.today.newSubs(today.value.newSubs), to: '/inbox' },
  { n: today.value.review.length, label: t.today.review(today.value.review.length), to: today.value.review.length === 1 ? `/studio?episode=${today.value.review[0]}` : '/stories' },
  { n: today.value.illustrate.length, label: t.today.illustrate(today.value.illustrate.length), to: today.value.illustrate.length === 1 ? `/studio?episode=${today.value.illustrate[0]}` : '/stories' },
  { n: today.value.failedJobs, label: t.today.failed(today.value.failedJobs), to: '/stories' },
  ...today.value.planned.map(p => ({ n: 1, label: t.today.planned(p.date, episodes.value.find(e => e.id === p.id)?.title ?? ''), to: `/studio?episode=${p.id}` })),
].filter(x => x.n > 0))
const month = computed(() => monthStats(episodes.value))
const krw = (n: number) => `₩${n.toLocaleString('ko-KR')}`
const hideGuide = useLocalStorage('toonflow:guideHidden', false)
const guide = computed(() => [
  { done: styles.value.length > 0, label: t.guide.style, to: '/styles' },
  { done: characters.value.length > 0, label: t.guide.character, to: '/characters' },
  { done: episodes.value.length > 0, label: t.guide.episode, to: '/stories' },
])
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-6 p-8">
    <div class="flex flex-col gap-1">
      <p class="text-muted-foreground text-sm">{{ t.welcome(auth.workspace?.name ?? '') }}</p>
      <h1 class="text-2xl font-bold">{{ ko.brand.slogan }}</h1>
    </div>

    <div class="flex gap-2">
      <Button as-child><NuxtLink to="/stories">{{ t.start }}</NuxtLink></Button>
      <Button variant="outline" as-child><NuxtLink to="/inbox">{{ t.addStory }}</NuxtLink></Button>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <section class="bg-card flex flex-col gap-2 rounded-lg border p-4">
        <h2 class="font-semibold">{{ t.today.title }}</h2>
        <p v-if="!todo.length" class="text-muted-foreground text-sm">{{ t.today.none }}</p>
        <NuxtLink v-for="x in todo" :key="x.label" :to="x.to" class="text-sm hover:underline">· {{ x.label }}</NuxtLink>
      </section>
      <section class="bg-card flex flex-col gap-2 rounded-lg border p-4">
        <h2 class="font-semibold">{{ t.month.title }}</h2>
        <dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <dt class="text-muted-foreground">{{ t.month.created }}</dt><dd>{{ month.created }}</dd>
          <dt class="text-muted-foreground">{{ t.month.published }}</dt><dd>{{ month.published }}</dd>
          <dt class="text-muted-foreground">{{ t.month.avgCost }}</dt><dd>{{ krw(month.avgCostKrw) }}</dd>
          <dt class="text-muted-foreground">{{ t.month.avgHours }}</dt><dd>{{ t.month.hours(month.avgHours) }}</dd>
          <dt class="text-muted-foreground">{{ t.month.spent }}</dt><dd>{{ krw(usedKrw) }}</dd>
        </dl>
      </section>
    </div>

    <section v-if="!hideGuide && guide.some(g => !g.done)" class="bg-card flex flex-col gap-2 rounded-lg border p-4">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold">{{ t.guide.title }}</h2>
        <button class="text-muted-foreground text-xs hover:underline" @click="hideGuide = true">{{ t.guide.hide }}</button>
      </div>
      <NuxtLink v-for="(g, i) in guide" :key="i" :to="g.to" class="flex items-center gap-2 text-sm hover:underline">
        <span class="flex size-5 items-center justify-center rounded-full border text-xs" :class="g.done ? 'bg-primary text-primary-foreground border-primary' : ''">{{ g.done ? '✓' : i + 1 }}</span>
        <span :class="g.done ? 'text-muted-foreground line-through' : ''">{{ g.label }}</span>
      </NuxtLink>
    </section>

    <section class="flex flex-col gap-2">
      <h2 class="font-semibold">{{ t.continue }}</h2>
      <p v-if="!recent.length" class="text-muted-foreground text-sm">{{ t.noRecent }}</p>
      <NuxtLink
        v-for="e in recent" :key="e.id" :to="{ path: '/studio', query: { episode: e.id, step: e.step } }"
        class="bg-card hover:bg-muted flex items-center justify-between rounded-lg border px-4 py-3"
      >
        <span class="flex flex-col">
          <span class="text-sm font-medium">{{ e.title }}</span>
          <span class="text-muted-foreground text-xs">{{ seriesName(e.seriesId) }} · {{ e.number }}화</span>
        </span>
        <span class="text-xs">{{ t.steps[e.step] }}</span>
      </NuxtLink>
    </section>
  </div>
</template>
