<script setup lang="ts">
import type { Cut } from '#shared/studio'
import { ko } from '~/locales/ko'

// SBD-30 콘티 보기: 장 단위 썸네일 (그림이 없으면 장면 설명 글 상자)
const props = defineProps<{ cuts: Cut[], selectedId: string, aspect: string }>()
const emit = defineEmits<{ select: [id: string] }>()
const pages = computed(() => {
  const out: Cut[][] = []
  for (const c of props.cuts) (out[c.pageIndex] ??= []).push(c)
  return out.filter(Boolean)
})
const grid: Record<string, string> = { '1': 'grid-cols-1', '2v': 'grid-rows-2', '2h': 'grid-cols-2', '3': 'grid-rows-3', '4': 'grid-cols-2 grid-rows-2' }
</script>

<template>
  <div class="grid w-full flex-1 grid-cols-[repeat(auto-fill,minmax(160px,1fr))] content-start gap-4 overflow-y-auto">
    <div v-for="cs in pages" :key="cs[0]!.page.id" class="flex flex-col gap-1">
      <span class="text-muted-foreground text-xs">{{ ko.studio.page(cs[0]!.pageIndex + 1) }}</span>
      <div class="bg-card grid gap-0.5 rounded border p-0.5" :class="grid[cs[0]!.page.layout]" :style="{ aspectRatio: aspect }">
        <button
          v-for="c in cs" :key="c.panel.id" class="overflow-hidden bg-neutral-100 text-left text-[10px] leading-tight text-neutral-700"
          :class="{ 'ring-primary ring-2': c.panel.id === selectedId }" @click="emit('select', c.panel.id)"
        >
          <StudioPanelImage v-if="c.panel.selectedCandidateId" :candidate-id="c.panel.selectedCandidateId" :crop="c.panel.crop" class="relative size-full" />
          <span v-else class="line-clamp-6 p-1.5">{{ c.panel.scene || ko.studio.noScene }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
