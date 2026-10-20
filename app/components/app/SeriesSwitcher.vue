<script setup lang="ts">
import { ko } from '~/locales/ko'

// EPI-05: 워크스페이스 아래에서 작업할 작품을 고르면 Stories·제작실·캐릭터·그림체·에셋·Home이 그 작품만 보여요
defineProps<{ collapsed: boolean }>()
const { series } = useStories()
const current = useSeriesFilter(series)
const live = computed(() => series.value.filter(s => !s.archivedAt || s.id === current.value))
</script>

<template>
  <div v-if="!collapsed && series.length" class="px-1 pb-3">
    <AppSelect v-model="current" class="border-sidebar-border bg-sidebar h-8 w-full rounded-md border px-2 text-xs" :aria-label="ko.seriesScope.label">
      <option value="">
        {{ ko.seriesScope.all }}
      </option>
      <option v-for="s in live" :key="s.id" :value="s.id">
        {{ s.name }}
      </option>
    </AppSelect>
  </div>
</template>
