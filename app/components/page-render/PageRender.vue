<script setup lang="ts">
import type { Bubble, Typeset } from '#shared/render'
import type { Cut } from '#shared/studio'
import { getDownloadURL, ref as storageRef } from 'firebase/storage'
import { candidatePath } from '#shared/illustrate'
import { cutRects, fontCss, layoutPage, pageSize, spikyPath } from '#shared/render'

// 장 렌더러 (R5): 화면·출력 공용 SVG. 편집 모드에서 말풍선을 끌어 옮기고 크기를 바꾼다 (REV-02)
const props = defineProps<{ cuts: Cut[], aspect?: string, typeset: Typeset, edit?: boolean, selectedPanelId?: string, selectedBubble?: string | null, label?: string | null, watermark?: string | null }>()
const emit = defineEmits<{ select: [panelId: string, dialogueId: string | null], move: [panelId: string, dialogueId: string, patch: Pick<Bubble, 'x' | 'y' | 'w' | 'h'>] }>()
const { $storage } = useNuxtApp()
const auth = useAuthStore()
const cache = useState<Record<string, string>>('storage-urls', () => ({}))
const size = computed(() => pageSize(props.aspect))
const rects = computed(() => cutRects(props.cuts[0]?.page.layout ?? '1', props.cuts.length, size.value.w, size.value.h))
const urls = reactive<Record<string, string>>({})
watchEffect(() => {
  for (const c of props.cuts) {
    const id = c.panel.selectedCandidateId
    if (!id || !auth.workspace || urls[id]) continue
    const p = candidatePath(auth.workspace.id, id)
    if (cache.value[p]) urls[id] = cache.value[p]!
    else getDownloadURL(storageRef($storage, p)).then(u => (urls[id] = cache.value[p] = u)).catch(() => {})
  }
})

const drag = ref<{ panelId: string, dialogueId: string, mode: 'move' | 'resize', sx: number, sy: number, b: Bubble, live: Bubble } | null>(null)
const svg = ref<SVGSVGElement>()
const toSvg = (e: PointerEvent) => {
  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.value!.getScreenCTM()!.inverse())
  return { x: pt.x, y: pt.y }
}
const items = computed(() => layoutPage(props.cuts, size.value.w, size.value.h, props.typeset, (pid, b) => (drag.value?.panelId === pid && drag.value.dialogueId === b.dialogueId ? drag.value.live : b))
  .map(it => ({ ...it, url: it.cut.panel.selectedCandidateId ? urls[it.cut.panel.selectedCandidateId] : undefined })))

function down(e: PointerEvent, panelId: string, b: Bubble, mode: 'move' | 'resize') {
  emit('select', panelId, b.dialogueId)
  if (!props.edit) return
  e.stopPropagation()
  const p = toSvg(e)
  drag.value = { panelId, dialogueId: b.dialogueId, mode, sx: p.x, sy: p.y, b, live: b }
  ;(e.target as Element).setPointerCapture(e.pointerId)
}
function moveDrag(e: PointerEvent) {
  const d = drag.value
  if (!d) return
  const r = rects.value[props.cuts.findIndex(c => c.panel.id === d.panelId)]!
  const p = toSvg(e)
  const dx = (p.x - d.sx) / r.w
  const dy = (p.y - d.sy) / r.h
  d.live = d.mode === 'move'
    ? { ...d.b, x: d.b.x + dx, y: d.b.y + dy }
    : { ...d.b, w: Math.max(0.08, d.b.w + dx), h: Math.max(0.05, d.b.h + dy) }
}
function up() {
  const d = drag.value
  drag.value = null
  if (d && (d.live.x !== d.b.x || d.live.y !== d.b.y || d.live.w !== d.b.w || d.live.h !== d.b.h)) {
    const { x, y, w, h } = d.live
    emit('move', d.panelId, d.dialogueId, { x, y, w, h })
  }
}
defineExpose({ svg })
</script>

<template>
  <svg
    ref="svg" :viewBox="`0 0 ${size.w} ${size.h}`" xmlns="http://www.w3.org/2000/svg" class="block bg-white select-none" :style="{ aspectRatio: `${size.w} / ${size.h}` }"
    @pointermove="moveDrag" @pointerup="up" @pointercancel="up"
  >
    <defs>
      <clipPath v-for="it in items" :id="`clip-${it.cut.panel.id}`" :key="it.cut.panel.id">
        <rect :x="it.r.x" :y="it.r.y" :width="it.r.w" :height="it.r.h" />
      </clipPath>
    </defs>
    <g v-for="it in items" :key="it.cut.panel.id" @pointerdown="emit('select', it.cut.panel.id, null)">
      <g :clip-path="`url(#clip-${it.cut.panel.id})`">
        <rect :x="it.r.x" :y="it.r.y" :width="it.r.w" :height="it.r.h" fill="#F4F4F5" />
        <image v-if="it.url" :href="it.url" :x="it.img.x" :y="it.img.y" :width="it.img.w" :height="it.img.h" preserveAspectRatio="xMidYMid slice" />
        <text v-else :x="it.r.x + it.r.w / 2" :y="it.r.y + it.r.h / 2" text-anchor="middle" font-size="28" fill="#71717A">{{ it.cut.panel.scene.slice(0, 24) }}</text>
        <g v-for="bb in it.bubbles" :key="bb.b.dialogueId" :class="edit ? 'cursor-move' : ''" @pointerdown="down($event, it.cut.panel.id, bb.b, 'move')">
          <template v-if="bb.b.shape !== 'sfx'">
            <polygon v-if="bb.tail && bb.b.shape !== 'thought'" :points="bb.tail" fill="#fff" stroke="#1F2A44" stroke-width="3" stroke-linejoin="round" />
            <rect v-if="bb.b.shape === 'narration'" :x="bb.px.x" :y="bb.px.y" :width="bb.px.w" :height="bb.px.h" fill="#FFF8E7" stroke="#1F2A44" stroke-width="3" />
            <path v-else-if="bb.b.shape === 'shout'" :d="spikyPath(bb.px)" fill="#fff" stroke="#1F2A44" stroke-width="4" stroke-linejoin="round" />
            <ellipse
              v-else :cx="bb.px.x + bb.px.w / 2" :cy="bb.px.y + bb.px.h / 2" :rx="bb.px.w / 2" :ry="bb.px.h / 2" fill="#fff" stroke="#1F2A44" stroke-width="3"
              :stroke-dasharray="bb.b.shape === 'whisper' ? '10 8' : bb.b.shape === 'thought' ? '2 0' : undefined"
            />
            <template v-if="bb.b.shape === 'thought' && bb.b.tail !== 'none'">
              <circle :cx="bb.px.x + bb.px.w * 0.5" :cy="bb.b.tail.startsWith('t') ? bb.px.y - 14 : bb.px.y + bb.px.h + 14" r="10" fill="#fff" stroke="#1F2A44" stroke-width="3" />
              <circle :cx="bb.px.x + bb.px.w * 0.5 + 16" :cy="bb.b.tail.startsWith('t') ? bb.px.y - 38 : bb.px.y + bb.px.h + 38" r="6" fill="#fff" stroke="#1F2A44" stroke-width="3" />
            </template>
          </template>
          <text
            :x="bb.px.x + bb.px.w / 2" :y="bb.px.y + bb.px.h / 2 - ((bb.lines.length - 1) * bb.lh) / 2" text-anchor="middle" dominant-baseline="middle"
            :font-family="fontCss(typeset.font)" :font-size="bb.b.fontSize" :font-weight="bb.b.bold ? 700 : 500"
            :fill="bb.b.shape === 'sfx' ? '#fff' : '#1F2A44'" :stroke="bb.b.shape === 'sfx' ? typeset.strokeColor : undefined"
            :stroke-width="bb.b.shape === 'sfx' ? typeset.strokeWidth * 2 : undefined" paint-order="stroke"
          >
            <tspan v-for="(l, i) in bb.lines" :key="i" :x="bb.px.x + bb.px.w / 2" :dy="i ? bb.lh : 0">{{ l }}</tspan>
          </text>
          <template v-if="edit && it.cut.panel.id === selectedPanelId && bb.b.dialogueId === selectedBubble">
            <rect :x="bb.px.x - 4" :y="bb.px.y - 4" :width="bb.px.w + 8" :height="bb.px.h + 8" fill="none" stroke="#FF735C" stroke-width="3" stroke-dasharray="8 6" />
            <rect :x="bb.px.x + bb.px.w - 10" :y="bb.px.y + bb.px.h - 10" width="20" height="20" fill="#FF735C" class="cursor-nwse-resize" @pointerdown="down($event, it.cut.panel.id, bb.b, 'resize')" />
          </template>
        </g>
      </g>
      <rect :x="it.r.x" :y="it.r.y" :width="it.r.w" :height="it.r.h" fill="none" :stroke="it.cut.panel.id === selectedPanelId && edit ? '#FF735C' : '#1F2A44'" stroke-width="4" pointer-events="none" />
    </g>
    <text v-if="label" :x="size.w - 24" :y="size.h - 4" text-anchor="end" font-size="18" fill="#71717A" font-family="Pretendard Variable, sans-serif">{{ label }}</text>
    <text v-if="watermark" x="24" :y="size.h - 4" font-size="18" fill="#71717A" font-family="Pretendard Variable, sans-serif">{{ watermark }}</text>
  </svg>
</template>
