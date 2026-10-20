<script setup lang="ts">
import { X } from '@lucide/vue'
import { ko } from '~/locales/ko'

// EPI-05: 작품을 골라 둔 화면 위에 "작품 A만 보는 중" 표시와 전체 보기
const { series } = useStories()
const current = useSeriesFilter(series)
const name = computed(() => series.value.find(s => s.id === current.value)?.name ?? '')
</script>

<template>
  <span v-if="current" class="bg-muted flex h-9 items-center gap-1 rounded-md px-3 text-sm">
    {{ ko.seriesScope.only(name) }}
    <button type="button" class="hover:text-foreground text-muted-foreground" :aria-label="ko.seriesScope.all" :title="ko.seriesScope.all" @click="current = ''">
      <X class="size-3.5" />
    </button>
  </span>
</template>
