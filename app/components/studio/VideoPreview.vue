<script setup lang="ts">
import { Pause, Play } from '@lucide/vue'
import { fmtSec } from '#shared/video'
import { ko } from '~/locales/ko'

// PUB-37: 재생·멈춤 미리 보기. 내보낼 때와 같은 프레임 렌더러를 쓴다
type Draw = (ctx: CanvasRenderingContext2D, t: number) => void
const props = defineProps<{ draw: Draw, width: number, height: number, total: number }>()
const time = defineModel<number>({ default: 0 })
const t = ko.studio.video
const cv = ref<HTMLCanvasElement>()
const playing = ref(false)
let raf = 0
let last = 0
const paint = () => {
  const ctx = cv.value?.getContext('2d')
  if (ctx) props.draw(ctx, time.value)
}
function tick(now: number) {
  time.value = Math.min(props.total, time.value + (now - last))
  last = now
  if (time.value >= props.total) playing.value = false
  else raf = requestAnimationFrame(tick)
}
function toggle() {
  playing.value = !playing.value
  cancelAnimationFrame(raf)
  if (!playing.value) return
  if (time.value >= props.total) time.value = 0
  last = performance.now()
  raf = requestAnimationFrame(tick)
}
watch([() => props.draw, time, () => props.width, () => props.height], () => nextTick(paint), { immediate: true })
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <canvas ref="cv" :width="width" :height="height" class="bg-card max-h-[62vh] w-auto max-w-full rounded-md border shadow-sm" :aria-label="t.preview" />
    <div class="flex w-full max-w-sm items-center gap-2 text-xs">
      <Button size="icon" variant="outline" class="size-8" :aria-label="playing ? t.pause : t.play" :disabled="!total" @click="toggle">
        <Pause v-if="playing" class="size-4" /><Play v-else class="size-4" />
      </Button>
      <input v-model.number="time" type="range" min="0" :max="total" step="33" class="flex-1" :aria-label="t.seek">
      <span class="text-muted-foreground w-24 text-right tabular-nums">{{ fmtSec(time) }} / {{ fmtSec(total) }}</span>
    </div>
  </div>
</template>
