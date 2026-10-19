<script setup lang="ts">
import type { Clip } from '#shared/video'
import { clampMs, fmtSec } from '#shared/video'
import { ko } from '~/locales/ko'

// PUB-37: 컷 막대. 오른쪽 끝을 끌어 시간 조절
const props = defineProps<{ clips: Clip[], total: number, selectedId: string, edit: boolean }>()
const emit = defineEmits<{ select: [clip: Clip], duration: [id: string, ms: number] }>()
const t = ko.studio.video
const box = ref<HTMLElement>()
const drag = ref<{ id: string, x0: number, ms0: number, ms: number, perPx: number } | null>(null)
const ms = (c: Clip) => (drag.value?.id === c.id ? drag.value.ms : c.durationMs)
const sum = computed(() => props.clips.reduce((n, c) => n + ms(c), 0) || 1)
function down(e: PointerEvent, c: Clip) {
  if (!props.edit || !box.value) return
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  drag.value = { id: c.id, x0: e.clientX, ms0: c.durationMs, ms: c.durationMs, perPx: sum.value / box.value.clientWidth }
}
function move(e: PointerEvent) {
  if (drag.value) drag.value.ms = clampMs(drag.value.ms0 + (e.clientX - drag.value.x0) * drag.value.perPx)
}
function up() {
  const d = drag.value
  drag.value = null
  if (d && d.ms !== d.ms0) emit('duration', d.id, d.ms)
}
</script>

<template>
  <div class="flex w-full flex-col gap-1">
    <div ref="box" class="flex h-14 w-full select-none overflow-hidden rounded-md border" role="list" :aria-label="t.timeline">
      <div
        v-for="(c, i) in clips" :key="c.id" role="listitem" class="relative flex min-w-0 flex-col justify-center border-r px-1.5 text-xs last:border-r-0"
        :class="c.id === selectedId ? 'bg-primary/15' : 'bg-card hover:bg-muted'" :style="{ flexGrow: ms(c), flexBasis: 0 }"
      >
        <button class="truncate text-left" @click="emit('select', c)">
          <span class="font-medium">{{ i + 1 }}</span> <span class="text-muted-foreground tabular-nums">{{ fmtSec(ms(c)) }}</span>
        </button>
        <span
          v-if="edit" class="hover:bg-primary/40 absolute top-0 right-0 h-full w-1.5 cursor-ew-resize" :title="t.dragHint" :aria-label="t.dragHint"
          @pointerdown.prevent="down($event, c)" @pointermove="move" @pointerup="up" @pointercancel="up"
        />
      </div>
    </div>
    <p class="text-muted-foreground text-xs">{{ t.dragHint }}</p>
  </div>
</template>
