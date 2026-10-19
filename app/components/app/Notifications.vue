<script setup lang="ts">
import type { JobNote } from '~/composables/useNotifications'
import { Bell } from '@lucide/vue'
import { onClickOutside } from '@vueuse/core'
import { ko } from '~/locales/ko'

const t = ko.notifications
const { shown: jobs, prefs, unread, markSeen } = useNotifications()
const showPrefs = ref(false)
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
const count = computed(() => unread.value + (usageLevel.value === 'ok' ? 0 : 1))
</script>

<template>
  <div ref="box" class="relative">
    <Button variant="ghost" size="icon" :aria-label="ko.nav.notifications" @click="toggle">
      <Bell class="size-4" />
      <span v-if="count" class="bg-primary text-primary-foreground absolute top-1 right-1 rounded-full px-1 text-[10px] leading-4">{{ count }}</span>
    </Button>
    <div v-if="open" class="bg-popover absolute right-0 z-20 mt-1 flex max-h-96 w-80 flex-col overflow-y-auto rounded-md border p-1 text-sm shadow-md">
      <div class="flex justify-end px-1">
        <button class="text-muted-foreground text-xs hover:underline" @click="showPrefs = !showPrefs">{{ t.prefs.title }}</button>
      </div>
      <div v-if="showPrefs" class="bg-muted/50 mb-1 flex flex-col gap-1 rounded px-2 py-1.5 text-xs">
        <label v-for="k in (['done', 'failed', 'usage'] as const)" :key="k" class="flex items-center gap-1.5"><input v-model="prefs[k]" type="checkbox"> {{ t.prefs[k] }}</label>
      </div>
      <p v-if="usageLevel !== 'ok'" class="rounded px-2 py-1.5 text-xs" :class="level === 'warn' ? 'bg-amber-100 text-amber-900' : 'bg-destructive/10 text-destructive'">
        {{ level === 'warn' ? t.usageWarn : t.usageOver }}
      </p>
      <p v-if="!jobs.length" class="text-muted-foreground px-2 py-3 text-xs">{{ t.empty }}</p>
      <NuxtLink v-for="j in jobs" :key="j.id" :to="link(j)" class="hover:bg-muted flex flex-col rounded px-2 py-1.5" @click="open = false">
        <span :class="j.status === 'failed' ? 'text-destructive' : ''">{{ t.types[j.type] ?? j.type }} · {{ j.status === 'failed' ? t.failed : t.done }}</span>
        <span class="text-muted-foreground text-xs">{{ j.finishedAt!.toMillis() > 0 ? new Date(j.finishedAt!.toMillis()).toLocaleString('ko-KR') : '' }}</span>
      </NuxtLink>
    </div>
  </div>
</template>
