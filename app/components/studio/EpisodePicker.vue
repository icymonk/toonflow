<script setup lang="ts">
import { Clapperboard } from '@lucide/vue'
import { useLocalStorage } from '@vueuse/core'
import { stageOf } from '#shared/episodes'
import { NAV_MAIN } from '~/lib/nav'
import { ko } from '~/locales/ko'

// STU: 에피소드 없이 제작실에 오면 마지막으로 연 에피소드로, 없으면 최근 에피소드 목록
const t = ko.studio.picker
const item = NAV_MAIN.find(i => i.to === '/studio')!
const route = useRoute()
const auth = useAuthStore()
const { series, episodes, loading } = useStories()
const last = useLocalStorage<Record<string, string>>('toonflow:studio:last', {})
const recent = computed(() => episodes.value.filter(e => !e.archivedAt).slice(0, 12))
const seriesName = (id: string) => series.value.find(s => s.id === id)?.name ?? ''

watch(loading, (l) => {
  if (l || route.query.pick) return
  const id = last.value[auth.workspace?.id ?? '']
  if (id && episodes.value.some(e => e.id === id)) navigateTo({ path: '/studio', query: { episode: id } }, { replace: true })
}, { immediate: true })
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-8">
    <h1 class="text-2xl font-bold">
      {{ item.label }} <span class="text-muted-foreground text-base font-normal">· {{ item.ko }}</span>
    </h1>
    <AppListSkeleton v-if="loading" />
    <AppEmptyState v-else-if="!recent.length" :icon="Clapperboard" :title="ko.empty.studio.title" :body="ko.empty.studio.body">
      <NuxtLink :to="{ path: '/stories', query: { new: '1' } }" class="text-sm underline">
        {{ t.create }}
      </NuxtLink>
    </AppEmptyState>
    <template v-else>
      <p class="text-muted-foreground text-sm">
        {{ t.pick }}
      </p>
      <ul class="divide-y rounded-lg border">
        <li v-for="e in recent" :key="e.id">
          <NuxtLink :to="{ path: '/studio', query: { episode: e.id } }" class="hover:bg-muted flex items-center justify-between gap-3 px-4 py-3">
            <span class="min-w-0">
              <span class="block truncate font-medium">{{ e.title || t.untitled }}</span>
              <span class="text-muted-foreground block truncate text-xs">{{ seriesName(e.seriesId) }} · {{ t.number(e.number) }}</span>
            </span>
            <span class="bg-muted shrink-0 rounded px-2 py-0.5 text-xs">{{ ko.stories.stages[stageOf(e)] }}</span>
          </NuxtLink>
        </li>
      </ul>
      <NuxtLink to="/stories" class="text-muted-foreground self-start text-sm underline">
        {{ t.all }}
      </NuxtLink>
    </template>
  </div>
</template>
