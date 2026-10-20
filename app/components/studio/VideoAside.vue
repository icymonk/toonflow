<script setup lang="ts">
import { Download } from '@lucide/vue'
import type { Clip, ClipSettings, VideoSettings } from '#shared/video'
import { COVER_PREFIX, fmtSec, MAX_CLIP_MS, MIN_CLIP_MS, MOTIONS, REELS_MAX_MS, STRENGTHS, TRANSITIONS, VIDEO_SIZES } from '#shared/video'
import { ko } from '~/locales/ko'

// PUB-30~35·37: 영상 규격·단위·컷별 시간/움직임/전환/말풍선 등장
const props = defineProps<{
  settings: VideoSettings
  clips: Clip[]
  clip: Clip | null
  index: number
  total: number
  edit: boolean
  musicUrl: string | null
  musicName: string | null
  supported: boolean | null
  progress: number | null
}>()
const emit = defineEmits<{
  save: [patch: Partial<Omit<VideoSettings, 'clips'>>]
  clip: [id: string, patch: Partial<ClipSettings>]
  auto: [id: string]
  all: [ms: number]
  upload: [file: File]
  removeMusic: []
  mp4: []
  cancel: []
}>()
const rights = ref(false)
const isCover = computed(() => !!props.clip?.id.startsWith(COVER_PREFIX))
const coverOptions = computed(() => props.clips.filter(c => !c.id.startsWith(COVER_PREFIX)))
function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (f) emit('upload', f)
}
const t = ko.studio.video
const sel = 'border-input bg-card h-8 rounded-md border px-2 text-sm'
const val = (e: Event) => (e.target as HTMLSelectElement | HTMLInputElement).value
const set = (patch: Partial<ClipSettings>) => props.clip && emit('clip', props.clip.id, patch)
// 다른 설정이 저장돼 다시 그려져도 입력 중인 시간이 원래 값으로 돌아가지 않게, 컷이나 저장된 값이 바뀔 때만 맞춘다
const dur = ref(0)
watch(() => [props.clip?.id, props.clip?.durationMs] as const, ([, ms]) => {
  if (ms != null) dur.value = ms / 1000
}, { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-3 text-sm">
    <label class="flex items-center gap-2 text-xs">{{ t.aspect }}
      <AppSelect :value="settings.aspect" :class="sel" :disabled="!edit" @change="emit('save', { aspect: $event as VideoSettings['aspect'] })">
        <option v-for="(v, k) in VIDEO_SIZES" :key="k" :value="k">{{ k }} ({{ v.w }}×{{ v.h }}){{ k === '9:16' ? ` · ${t.reels}` : '' }}</option>
      </AppSelect>
    </label>
    <label class="flex items-center gap-2 text-xs">{{ t.unit }}
      <AppSelect :value="settings.unit" :class="sel" :disabled="!edit" @change="emit('save', { unit: $event as VideoSettings['unit'] })">
        <option value="panel">{{ t.unitPanel }}</option>
        <option value="page">{{ t.unitPage }}</option>
      </AppSelect>
    </label>
    <p class="text-xs">{{ t.total(fmtSec(total)) }}</p>
    <div v-if="total > REELS_MAX_MS" class="rounded-md bg-amber-100 px-2 py-1.5 text-xs text-amber-900" role="alert">{{ t.overLimit(REELS_MAX_MS / 1000) }}</div>

    <section v-if="clip" class="flex flex-col gap-2 border-t pt-3">
      <span class="font-medium">{{ isCover ? t.coverClip : t.clip(index + 1) }}</span>
      <label class="flex items-center gap-2 text-xs">{{ t.duration }}
        <input
          type="number" :aria-label="t.duration" v-model.number="dur" :min="MIN_CLIP_MS / 1000" :max="MAX_CLIP_MS / 1000" step="0.1" :class="[sel, 'w-20']" :disabled="!edit"
          @change="set({ durationMs: dur * 1000 })"
        >
      </label>
      <div v-if="!isCover" class="flex gap-1.5">
        <Button size="sm" variant="outline" :disabled="!edit" @click="emit('auto', clip.id)">{{ t.auto }}</Button>
        <Button size="sm" variant="outline" :disabled="!edit" @click="emit('all', clip.durationMs)">{{ t.applyAll }}</Button>
      </div>
      <label v-if="!isCover" class="flex items-center gap-2 text-xs">{{ t.motion }}
        <AppSelect :value="clip.motion" :aria-label="t.motion" :class="sel" :disabled="!edit" @change="set({ motion: $event as ClipSettings['motion'] })">
          <option v-for="m in MOTIONS" :key="m" :value="m">{{ t.motions[m] }}</option>
        </AppSelect>
      </label>
      <label v-if="!isCover && clip.motion !== 'none'" class="flex items-center gap-2 text-xs">{{ t.strength }}
        <AppSelect :value="clip.strength" :class="sel" :disabled="!edit" @change="set({ strength: $event as ClipSettings['strength'] })">
          <option v-for="(_, k) in STRENGTHS" :key="k" :value="k">{{ t.strengths[k] }}</option>
        </AppSelect>
      </label>
      <template v-if="index > 0">
        <label class="flex items-center gap-2 text-xs">{{ t.transition }}
          <AppSelect :value="clip.transition" :class="sel" :disabled="!edit" @change="set({ transition: $event as ClipSettings['transition'] })">
            <option v-for="x in TRANSITIONS" :key="x" :value="x">{{ t.transitions[x] }}</option>
          </AppSelect>
        </label>
        <label v-if="clip.transition !== 'cut'" class="flex items-center gap-2 text-xs">{{ t.transitionMs }}
          <input type="number" :value="clip.transitionMs / 1000" min="0.1" max="1" step="0.1" :class="[sel, 'w-20']" :disabled="!edit" @change="set({ transitionMs: Math.round(Number(val($event)) * 1000) })">
        </label>
      </template>
      <p v-else class="text-muted-foreground text-xs">{{ t.firstNoTransition }}</p>
      <label v-if="!isCover && clip.bubbles > 1" class="flex items-center gap-2 text-xs">{{ t.reveal }}
        <AppSelect :value="clip.reveal" :class="sel" :disabled="!edit" @change="set({ reveal: $event as ClipSettings['reveal'] })">
          <option value="together">{{ t.reveals.together }}</option>
          <option value="sequence">{{ t.reveals.sequence }}</option>
        </AppSelect>
      </label>
    </section>

    <section class="flex flex-col gap-2 border-t pt-3">
      <label class="flex items-center gap-2 text-xs">{{ t.cover }}
        <AppSelect :value="settings.coverId ?? ''" :aria-label="t.cover" :class="sel" :disabled="!edit" @change="emit('save', { coverId: $event || null })">
          <option value="">{{ t.coverNone }}</option>
          <option v-for="(c, i) in coverOptions" :key="c.id" :value="c.id">{{ t.clip(i + 1) }}</option>
        </AppSelect>
      </label>
      <p class="text-muted-foreground text-xs">{{ t.coverHint }}</p>
    </section>

    <section class="flex flex-col gap-2 border-t pt-3">
      <span class="font-medium">{{ t.music }}</span>
      <template v-if="settings.musicPath">
        <p class="truncate text-xs">{{ musicName }}</p>
        <audio v-if="musicUrl" :src="musicUrl" controls class="h-8 w-full" />
        <p class="text-muted-foreground text-xs">{{ t.musicPreviewNote }}</p>
        <label class="flex items-center gap-2 text-xs">{{ t.musicVolume }}
          <AppSlider min="0" max="1" step="0.05" :model-value="settings.musicVolume" :aria-label="t.musicVolume" class="flex-1" :disabled="!edit" @change="emit('save', { musicVolume: $event })" />
          <span class="w-9 text-right tabular-nums">{{ Math.round(settings.musicVolume * 100) }}%</span>
        </label>
        <label class="flex items-center gap-2 text-xs">{{ t.musicFadeOut }}
          <input type="number" min="0" max="10" step="0.5" :value="settings.musicFadeOutMs / 1000" :class="[sel, 'w-20']" :disabled="!edit" @change="emit('save', { musicFadeOutMs: Math.round(Math.min(10, Math.max(0, Number(val($event)))) * 1000) })">
        </label>
        <label class="flex items-center gap-2 text-xs">
          <AppCheck :model-value="settings.musicLoop" :disabled="!edit" @change="emit('save', { musicLoop: $event })" />
          {{ t.musicLoop }}
        </label>
        <Button size="sm" variant="outline" class="self-start" :disabled="!edit" @click="emit('removeMusic')">{{ t.musicRemove }}</Button>
      </template>
      <template v-else>
        <p class="text-muted-foreground text-xs">{{ t.musicNone }}</p>
        <label class="flex items-center gap-2 text-xs">
          <AppCheck v-model="rights" :disabled="!edit" />
          {{ t.musicRights }}
        </label>
        <label class="text-xs" :class="rights && edit ? 'cursor-pointer' : 'pointer-events-none opacity-50'">
          <span class="border-input inline-flex h-8 items-center rounded-md border px-3">{{ t.musicUpload }}</span>
          <input type="file" accept="audio/*" class="sr-only" :aria-label="t.musicUpload" :disabled="!rights || !edit" @change="onFile">
        </label>
      </template>
    </section>

    <section class="flex flex-col gap-2 border-t pt-3">
      <p v-if="supported === false" class="rounded-md bg-amber-100 px-2 py-1.5 text-xs text-amber-900" role="alert">{{ t.mp4Unsupported }}</p>
      <template v-else-if="progress !== null">
        <div class="bg-muted h-2 overflow-hidden rounded-full" role="progressbar" :aria-valuenow="Math.round(progress * 100)" aria-valuemin="0" aria-valuemax="100">
          <div class="bg-primary h-full" :style="{ width: `${progress * 100}%` }" />
        </div>
        <p class="text-xs" aria-live="polite">{{ t.mp4Progress(Math.round(progress * 100)) }}</p>
        <Button size="sm" variant="outline" class="self-start" @click="emit('cancel')">{{ t.mp4Cancel }}</Button>
      </template>
      <Button v-else :disabled="!clips.length || supported !== true" @click="emit('mp4')"><Download class="size-4" /> {{ t.mp4 }}</Button>
      <p class="text-muted-foreground text-xs">{{ t.mp4Hint }}</p>
    </section>
  </div>
</template>
