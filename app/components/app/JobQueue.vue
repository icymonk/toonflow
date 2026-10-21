<script setup lang="ts">
import type { QueueJob } from '~/composables/useJobQueue'
import type { SocialPost } from '#shared/social'
import { ListTodo } from '@lucide/vue'
import { onClickOutside, useIntervalFn } from '@vueuse/core'
import { toast } from 'vue-sonner'
import { ACTIVE_STATUSES } from '#shared/jobs'
import { socialRatio } from '#shared/social'
import { errorMessage } from '~/lib/errors'
import { callFn } from '~/lib/functions'
import { ko } from '~/locales/ko'

// AIU-01 대기열 패널: 진행 중·최근 작업 (AI 작업 + SNS 게시)
const t = ko.queue
const auth = useAuthStore()
const route = useRoute()
const { $functions } = useNuxtApp()
const q = useJobQueue()
const open = ref(false)
const onlyEpisode = ref(false)
const box = ref<HTMLElement>()
onClickOutside(box, () => (open.value = false))
const now = ref(Date.now())
useIntervalFn(() => (now.value = Date.now()), 1000)
const episode = computed(() => (typeof route.query.episode === 'string' ? route.query.episode : null))

interface Row { key: string, label: string, status: string, episodeId?: string, panelId?: string, ratio: number | null, step: string, since?: number, end?: number, job?: QueueJob, url?: string }
const aiRow = (j: QueueJob): Row => ({ key: `j-${j.id}`, label: ko.notifications.types[j.type] ?? j.type, status: j.status, episodeId: j.target?.episodeId, panelId: j.target?.panelId, ratio: null, step: '', since: (j.startedAt ?? j.createdAt)?.toMillis(), end: j.finishedAt?.toMillis(), job: j })
const postRow = (p: SocialPost): Row => ({ key: `p-${p.id}`, label: t[p.platform], status: p.status, episodeId: p.episodeId, ratio: p.status === 'running' ? socialRatio(p.progress) : p.status === 'succeeded' ? 1 : null, step: p.status === 'running' && p.progress ? t.steps[p.progress.step](p.progress.done, p.progress.total) : '', since: (p.startedAt ?? p.createdAt)?.toMillis(), end: p.finishedAt?.toMillis(), url: p.url })
const scoped = (r: Row) => !onlyEpisode.value || !episode.value || r.episodeId === episode.value
const rows = computed(() => [...q.jobs.value.map(aiRow), ...q.posts.value.map(postRow)].filter(scoped).sort((a, b) => (b.since ?? 0) - (a.since ?? 0)))
const isActive = (r: Row) => (ACTIVE_STATUSES as readonly string[]).includes(r.status)
const active = computed(() => rows.value.filter(isActive))
const recent = computed(() => rows.value.filter(r => !isActive(r)).slice(0, 12))
const secs = (r: Row) => Math.max(0, Math.round(((r.end ?? now.value) - (r.since ?? now.value)) / 1000))
const link = (r: Row) => (r.episodeId ? { path: '/studio', query: { episode: r.episodeId, ...(r.panelId ? { panel: r.panelId } : {}) } } : null)

async function act(fn: 'cancelAiJob' | 'retryAiJob', j: QueueJob) {
  try {
    await callFn($functions, fn, { workspaceId: auth.workspace!.id, jobId: j.id })
    toast.success(fn === 'cancelAiJob' ? t.canceled : t.retried)
  }
  catch (error) { toast.error(errorMessage(error) ?? ko.errors.unknown) }
}
</script>

<template>
  <div ref="box" class="relative">
    <Button variant="ghost" size="icon" :aria-label="t.title" :title="t.title" @click="open = !open">
      <ListTodo class="size-4" />
      <span v-if="q.activeCount.value" class="bg-primary text-primary-foreground absolute top-1 right-1 rounded-full px-1 text-[10px] leading-4">{{ q.activeCount.value }}</span>
    </Button>
    <div v-if="open" class="bg-popover absolute right-0 z-20 mt-1 flex max-h-[70vh] w-96 max-w-[calc(100vw-1.5rem)] flex-col gap-1 overflow-y-auto rounded-md border p-2 text-sm shadow-md">
      <div class="flex items-center justify-between px-1">
        <span class="font-medium">{{ t.title }}</span>
        <label v-if="episode" class="flex items-center gap-1.5 text-xs"><AppCheck v-model="onlyEpisode" /> {{ t.thisEpisode }}</label>
      </div>
      <p class="text-muted-foreground px-1 pt-1 text-xs">{{ t.active }} {{ active.length }}</p>
      <p v-if="!active.length" class="text-muted-foreground px-1 py-2 text-xs">{{ t.empty }}</p>
      <div v-for="r in active" :key="r.key" class="flex flex-col gap-1 rounded border px-2 py-1.5">
        <div class="flex items-center gap-2">
          <NuxtLink v-if="link(r)" :to="link(r)!" class="truncate hover:underline" @click="open = false">{{ r.label }}</NuxtLink>
          <span v-else class="truncate">{{ r.label }}</span>
          <span class="text-muted-foreground ml-auto shrink-0 text-xs">{{ t.status[r.status] }} · {{ t.elapsed(secs(r)) }}</span>
          <Button v-if="r.job" size="sm" variant="ghost" class="h-6 px-1.5 text-xs" @click="act('cancelAiJob', r.job)">{{ t.cancel }}</Button>
        </div>
        <div class="bg-muted h-1.5 overflow-hidden rounded-full" role="progressbar" :aria-valuenow="r.ratio == null ? undefined : Math.round(r.ratio * 100)" aria-valuemin="0" aria-valuemax="100">
          <div v-if="r.ratio != null" class="bg-primary h-full transition-all" :style="{ width: `${Math.round(r.ratio * 100)}%` }" />
          <div v-else class="bg-primary/70 h-full w-1/3 animate-pulse" />
        </div>
        <span v-if="r.step" class="text-muted-foreground text-xs">{{ r.step }}</span>
      </div>
      <p class="text-muted-foreground px-1 pt-2 text-xs">{{ t.recent }}</p>
      <div v-for="r in recent" :key="r.key" class="flex items-center gap-2 rounded px-2 py-1 text-xs">
        <NuxtLink v-if="link(r)" :to="link(r)!" class="truncate hover:underline" @click="open = false">{{ r.label }}</NuxtLink>
        <span v-else class="truncate">{{ r.label }}</span>
        <span class="ml-auto shrink-0" :class="r.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'">{{ t.status[r.status] }} · {{ t.elapsed(secs(r)) }}</span>
        <a v-if="r.url" :href="r.url" target="_blank" rel="noopener" class="text-primary shrink-0 underline">{{ t.open }}</a>
        <Button v-if="r.job && r.status === 'failed' && r.job.error?.retryable !== false" size="sm" variant="ghost" class="h-6 px-1.5 text-xs" @click="act('retryAiJob', r.job)">{{ t.retry }}</Button>
      </div>
    </div>
  </div>
</template>
