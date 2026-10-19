<script setup lang="ts">
import type { Candidate } from '#shared/illustrate'
import { ChevronLeft, ChevronRight, X } from '@lucide/vue'
import { onKeyStroke } from '@vueuse/core'
import { ko } from '~/locales/ko'

// ILL-12 나란히 비교: 지금 선택 ↔ 후보, 좌우 키로 후보 넘기기
const props = defineProps<{ candidates: Candidate[], currentId: string | null, startId: string, aspect: string, edit: boolean }>()
const emit = defineEmits<{ close: [], choose: [id: string] }>()
const t = ko.studio.illustrate
const idx = ref(Math.max(0, props.candidates.findIndex(c => c.id === props.startId)))
const shown = computed(() => props.candidates[idx.value])
const move = (d: number) => (idx.value = (idx.value + d + props.candidates.length) % props.candidates.length)
onKeyStroke(['ArrowLeft', 'ArrowRight', 'Escape'], (e) => {
  e.preventDefault()
  if (e.key === 'Escape') emit('close')
  else move(e.key === 'ArrowLeft' ? -1 : 1)
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 p-6" role="dialog" :aria-label="t.compare">
    <button class="absolute top-4 right-4 text-white" :aria-label="ko.studio.close" @click="emit('close')"><X class="size-6" /></button>
    <div class="flex h-[75dvh] items-center gap-6">
      <figure class="flex h-full flex-col items-center gap-2">
        <div class="relative h-full bg-neutral-200" :style="{ aspectRatio: aspect }">
          <StudioPanelImage v-if="currentId" :candidate-id="currentId" class="absolute inset-0" />
          <p v-else class="flex h-full items-center justify-center p-4 text-sm text-neutral-600">{{ t.noCurrent }}</p>
        </div>
        <figcaption class="text-sm text-white">{{ t.current }}</figcaption>
      </figure>
      <button class="text-white" :aria-label="ko.studio.prev" @click="move(-1)"><ChevronLeft class="size-8" /></button>
      <figure v-if="shown" class="flex h-full flex-col items-center gap-2">
        <div class="relative h-full bg-neutral-200" :style="{ aspectRatio: aspect }">
          <AppStorageImg :path="shown.imagePath" class="absolute inset-0 size-full" />
        </div>
        <figcaption class="text-sm text-white">{{ t.candidate }} {{ idx + 1 }} / {{ candidates.length }}</figcaption>
      </figure>
      <button class="text-white" :aria-label="ko.studio.next" @click="move(1)"><ChevronRight class="size-8" /></button>
    </div>
    <Button v-if="edit && shown && shown.id !== currentId" @click="emit('choose', shown.id)">{{ t.choose }}</Button>
  </div>
</template>
