<script setup lang="ts">
import type { JobNote } from '~/composables/useNotifications'
import { Bell } from '@lucide/vue'
import { onClickOutside } from '@vueuse/core'
import { episodeTitle } from '#shared/episodes'
import { hasNewReply } from '#shared/feedback'
import { ko } from '~/locales/ko'

const t = ko.notifications
const { shown: jobs, withdrawals, prefs, unread, markSeen } = useNotifications()
const showPrefs = ref(false)
// CMN-62 피드백 답변: 피드백 화면에서 읽으면 사라져요
const fb = useFeedback()
const answered = computed(() => (prefs.value.feedback ? fb.mine.value.filter(f => f.adminReplyAt).slice(0, 5) : []))
const usageLevel = computed(() => (prefs.value.usage ? level.value : 'ok'))
const { level } = useUsage()
const open = ref(false)
const box = ref<HTMLElement>()
onClickOutside(box, () => (open.value = false))
function toggle() {
  open.value = !open.value
  if (open.value) markSeen()
}
const link = (j: JobNote) => j.target?.episodeId ? { path: '/studio', query: { episode: j.target.episodeId, ...(j.target.panelId ? { panel: j.target.panelId } : {}) } } : j.type === 'style.sample' ? '/styles' : '/characters'
// 알림에 작품 · 에피소드 이름. 동의 철회는 그 썰로 만든 에피소드
const { series, episodes } = useStories()
const label = (episodeId?: string) => {
  const ep = episodeId ? episodes.value.find(e => e.id === episodeId) : undefined
  const s = ep ? series.value.find(x => x.id === ep.seriesId) : undefined
  return [s?.name, ep && episodeTitle(ep.title, ep.number)].filter(Boolean).join(' · ')
}
const usedBy = (submissionId: string) => episodes.value.filter(e => e.submissionIds?.includes(submissionId)).map(e => label(e.id)).join(', ')
const count = computed(() => unread.value + (usageLevel.value === 'ok' ? 0 : 1) + (prefs.value.feedback ? fb.unread.value : 0))
</script>

<template>
  <div ref="box" class="relative">
    <Button variant="ghost" size="icon" :aria-label="ko.nav.notifications" @click="toggle">
      <Bell class="size-4" />
      <span v-if="count" class="bg-primary text-primary-foreground absolute top-1 right-1 rounded-full px-1 text-[10px] leading-4">{{ count }}</span>
    </Button>
    <div v-if="open" class="bg-popover fixed inset-x-3 top-14 z-20 mt-1 flex max-h-96 flex-col sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:w-80 overflow-y-auto rounded-md border p-1 text-sm shadow-md">
      <div class="flex justify-end px-1">
        <button class="text-muted-foreground text-xs hover:underline" @click="showPrefs = !showPrefs">{{ t.prefs.title }}</button>
      </div>
      <div v-if="showPrefs" class="bg-muted/50 mb-1 flex flex-col gap-1 rounded px-2 py-1.5 text-xs">
        <label v-for="k in (['done', 'failed', 'usage', 'withdrawn', 'feedback'] as const)" :key="k" class="flex items-center gap-1.5"><AppCheck v-model="prefs[k]" /> {{ t.prefs[k] }}</label>
      </div>
      <p v-if="usageLevel !== 'ok'" class="rounded px-2 py-1.5 text-xs" :class="level === 'warn' ? 'bg-amber-100 text-amber-900' : 'bg-destructive/10 text-destructive'">
        {{ level === 'warn' ? t.usageWarn : t.usageOver }}
      </p>
      <NuxtLink v-for="w in withdrawals" :key="w.id" :to="{ path: '/inbox', query: { id: w.id } }" class="hover:bg-muted flex flex-col rounded px-2 py-1.5" @click="open = false">
        <span class="text-destructive">{{ w.published ? t.withdrawnAfter : t.withdrawnBefore }}</span>
        <span v-if="usedBy(w.id)" class="truncate text-xs">{{ usedBy(w.id) }}</span>
        <span class="text-muted-foreground text-xs">{{ new Date(w.at.toMillis()).toLocaleString('ko-KR') }}</span>
      </NuxtLink>
      <NuxtLink v-for="f in answered" :key="`fb-${f.id}`" :to="{ path: '/feedback', query: { id: f.id } }" class="hover:bg-muted flex flex-col rounded px-2 py-1.5" @click="open = false">
        <span :class="hasNewReply(f, fb.seen.value) ? 'text-primary font-medium' : ''">{{ ko.feedback.answered }}</span>
        <span class="text-muted-foreground truncate text-xs">{{ f.text }}</span>
      </NuxtLink>
      <p v-if="!jobs.length && !withdrawals.length && !answered.length" class="text-muted-foreground px-2 py-3 text-xs">{{ t.empty }}</p>
      <NuxtLink v-for="j in jobs" :key="j.id" :to="link(j)" class="hover:bg-muted flex flex-col rounded px-2 py-1.5" @click="open = false">
        <span :class="j.status === 'failed' ? 'text-destructive' : ''">{{ t.types[j.type] ?? j.type }} · {{ j.status === 'failed' ? t.failed : t.done }}</span>
        <span v-if="label(j.target?.episodeId)" class="truncate text-xs">{{ label(j.target?.episodeId) }}</span>
        <span class="text-muted-foreground text-xs">{{ j.finishedAt!.toMillis() > 0 ? new Date(j.finishedAt!.toMillis()).toLocaleString('ko-KR') : '' }}</span>
      </NuxtLink>
    </div>
  </div>
</template>
