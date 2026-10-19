<script setup lang="ts">
import type { Clip, ClipSettings, VideoSettings } from '#shared/video'
import { fmtSec, MAX_CLIP_MS, MIN_CLIP_MS, MOTIONS, REELS_MAX_MS, STRENGTHS, TRANSITIONS, VIDEO_SIZES } from '#shared/video'
import { ko } from '~/locales/ko'

// PUB-30~35·37: 영상 규격·단위·컷별 시간/움직임/전환/말풍선 등장
const props = defineProps<{ settings: VideoSettings, clip: Clip | null, index: number, total: number, edit: boolean }>()
const emit = defineEmits<{ save: [patch: Partial<Omit<VideoSettings, 'clips'>>], clip: [id: string, patch: Partial<ClipSettings>], auto: [id: string], all: [ms: number] }>()
const t = ko.studio.video
const sel = 'border-input bg-card h-8 rounded-md border px-2 text-sm'
const val = (e: Event) => (e.target as HTMLSelectElement | HTMLInputElement).value
const set = (patch: Partial<ClipSettings>) => props.clip && emit('clip', props.clip.id, patch)
</script>

<template>
  <div class="flex flex-col gap-3 text-sm">
    <label class="flex items-center gap-2 text-xs">{{ t.aspect }}
      <select :value="settings.aspect" :class="sel" :disabled="!edit" @change="emit('save', { aspect: val($event) as VideoSettings['aspect'] })">
        <option v-for="(v, k) in VIDEO_SIZES" :key="k" :value="k">{{ k }} ({{ v.w }}×{{ v.h }}){{ k === '9:16' ? ` · ${t.reels}` : '' }}</option>
      </select>
    </label>
    <label class="flex items-center gap-2 text-xs">{{ t.unit }}
      <select :value="settings.unit" :class="sel" :disabled="!edit" @change="emit('save', { unit: val($event) as VideoSettings['unit'] })">
        <option value="panel">{{ t.unitPanel }}</option>
        <option value="page">{{ t.unitPage }}</option>
      </select>
    </label>
    <p class="text-xs">{{ t.total(fmtSec(total)) }}</p>
    <div v-if="total > REELS_MAX_MS" class="rounded-md bg-amber-100 px-2 py-1.5 text-xs text-amber-900" role="alert">{{ t.overLimit(REELS_MAX_MS / 1000) }}</div>

    <section v-if="clip" class="flex flex-col gap-2 border-t pt-3">
      <span class="font-medium">{{ t.clip(index + 1) }}</span>
      <label class="flex items-center gap-2 text-xs">{{ t.duration }}
        <input
          type="number" :aria-label="t.duration" :value="clip.durationMs / 1000" :min="MIN_CLIP_MS / 1000" :max="MAX_CLIP_MS / 1000" step="0.1" :class="[sel, 'w-20']" :disabled="!edit"
          @change="set({ durationMs: Number(val($event)) * 1000 })"
        >
      </label>
      <div class="flex gap-1.5">
        <Button size="sm" variant="outline" :disabled="!edit" @click="emit('auto', clip.id)">{{ t.auto }}</Button>
        <Button size="sm" variant="outline" :disabled="!edit" @click="emit('all', clip.durationMs)">{{ t.applyAll }}</Button>
      </div>
      <label class="flex items-center gap-2 text-xs">{{ t.motion }}
        <select :value="clip.motion" :aria-label="t.motion" :class="sel" :disabled="!edit" @change="set({ motion: val($event) as ClipSettings['motion'] })">
          <option v-for="m in MOTIONS" :key="m" :value="m">{{ t.motions[m] }}</option>
        </select>
      </label>
      <label v-if="clip.motion !== 'none'" class="flex items-center gap-2 text-xs">{{ t.strength }}
        <select :value="clip.strength" :class="sel" :disabled="!edit" @change="set({ strength: val($event) as ClipSettings['strength'] })">
          <option v-for="(_, k) in STRENGTHS" :key="k" :value="k">{{ t.strengths[k] }}</option>
        </select>
      </label>
      <template v-if="index > 0">
        <label class="flex items-center gap-2 text-xs">{{ t.transition }}
          <select :value="clip.transition" :class="sel" :disabled="!edit" @change="set({ transition: val($event) as ClipSettings['transition'] })">
            <option v-for="x in TRANSITIONS" :key="x" :value="x">{{ t.transitions[x] }}</option>
          </select>
        </label>
        <label v-if="clip.transition !== 'cut'" class="flex items-center gap-2 text-xs">{{ t.transitionMs }}
          <input type="number" :value="clip.transitionMs / 1000" min="0.1" max="1" step="0.1" :class="[sel, 'w-20']" :disabled="!edit" @change="set({ transitionMs: Math.round(Number(val($event)) * 1000) })">
        </label>
      </template>
      <p v-else class="text-muted-foreground text-xs">{{ t.firstNoTransition }}</p>
      <label v-if="clip.bubbles > 1" class="flex items-center gap-2 text-xs">{{ t.reveal }}
        <select :value="clip.reveal" :class="sel" :disabled="!edit" @change="set({ reveal: val($event) as ClipSettings['reveal'] })">
          <option value="together">{{ t.reveals.together }}</option>
          <option value="sequence">{{ t.reveals.sequence }}</option>
        </select>
      </label>
    </section>
    <p class="text-muted-foreground border-t pt-3 text-xs">{{ t.exportSoon }}</p>
  </div>
</template>
