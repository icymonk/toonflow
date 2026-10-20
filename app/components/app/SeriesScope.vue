<script setup lang="ts">
import { ko } from '~/locales/ko'

// EPI-05: 화면 위 작품 선택. 사이드바 "작업할 작품"과 같은 값이라 여기서 바꾸면 앱 전체가 그 작품으로 바뀌어요
const { series } = useStories()
const current = useSeriesFilter(series)
const live = computed(() => series.value.filter(s => !s.archivedAt || s.id === current.value))
</script>

<template>
  <AppSelect
    v-if="series.length" v-model="current" :aria-label="ko.seriesScope.filter"
    class="h-9 w-auto min-w-36 rounded-md border px-3 text-sm" :class="current ? 'border-primary bg-primary/10' : 'border-input bg-card'"
  >
    <option value="">
      {{ ko.seriesScope.all }}
    </option>
    <option v-for="s in live" :key="s.id" :value="s.id">
      {{ s.name }}
    </option>
  </AppSelect>
</template>
