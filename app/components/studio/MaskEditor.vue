<script setup lang="ts">
import { ko } from '~/locales/ko'

// ILL-22: 다시 그릴 부분을 붓으로 칠한다 (흰색 = 바꿀 곳)
defineProps<{ path: string }>()
const emit = defineEmits<{ done: [mask: Blob, change: string], close: [] }>()
const t = ko.studio.illustrate
const cv = ref<HTMLCanvasElement>()
const change = ref('')
const size = ref(40)
const drawing = ref(false)
const ctx = () => cv.value!.getContext('2d')!
function clear() {
  ctx().fillStyle = '#000'
  ctx().fillRect(0, 0, 1080, 1350)
}
onMounted(() => {
  cv.value!.width = 1080
  cv.value!.height = 1350
  clear()
})
function paint(e: PointerEvent) {
  if (!drawing.value) return
  const r = cv.value!.getBoundingClientRect()
  const x = ctx()
  x.fillStyle = '#fff'
  x.beginPath()
  x.arc((e.clientX - r.left) * 1080 / r.width, (e.clientY - r.top) * 1350 / r.height, size.value, 0, Math.PI * 2)
  x.fill()
}
function down(e: PointerEvent) {
  drawing.value = true
  paint(e)
}
function done() {
  cv.value!.toBlob(b => b && change.value.trim() && emit('done', b, change.value.trim()), 'image/png')
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" @click.self="emit('close')">
    <div class="bg-card flex max-h-full w-[min(560px,100%)] flex-col gap-2 overflow-y-auto rounded-lg p-4 text-sm">
      <span class="font-medium">{{ t.inpaint }}</span>
      <p class="text-muted-foreground text-xs">{{ t.inpaintHint }}</p>
      <div class="relative">
        <AppStorageImg :path="path" class="aspect-[4/5] w-full" />
        <canvas ref="cv" class="absolute inset-0 h-full w-full cursor-crosshair touch-none opacity-50" @pointerdown="down" @pointermove="paint" @pointerup="drawing = false" @pointerleave="drawing = false" />
      </div>
      <label class="flex items-center gap-2 text-xs">{{ t.brush }}<input v-model.number="size" type="range" min="10" max="120" class="flex-1"></label>
      <Input v-model="change" :placeholder="t.inpaintPh" />
      <div class="flex gap-2">
        <Button size="sm" :disabled="!change.trim()" @click="done">{{ t.inpaintGo }}</Button>
        <Button size="sm" variant="ghost" @click="clear">{{ t.clearMask }}</Button>
        <Button size="sm" variant="ghost" class="ml-auto" @click="emit('close')">{{ t.closeMask }}</Button>
      </div>
    </div>
  </div>
</template>
