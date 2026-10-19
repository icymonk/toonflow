<script setup lang="ts">
import type { Candidate } from '#shared/illustrate'
import type { Crop, Cut } from '#shared/studio'
import type { PanelJob } from '~/composables/useIllustrate'
import { Columns2, Loader2, RotateCcw, Sparkles, X } from '@lucide/vue'
import { useDebounceFn, useLocalStorage } from '@vueuse/core'
import { CANDIDATE_DEFAULT, zoomCrop } from '#shared/illustrate'
import { ACTIVE_STATUSES } from '#shared/jobs'
import { ko } from '~/locales/ko'

// ILL-01·03·04·05·06·10·11·20·23·40·41
const props = defineProps<{
  cut: Cut
  candidates: Candidate[]
  job?: PanelJob
  styleName: string
  characterNames: string[]
  promptOf: (o: { extra: string, leaveRoom: boolean }) => string
  estimate: (n: number) => number
  edit: boolean
}>()
const emit = defineEmits<{ generate: [n: number, opts: { extra: string, leaveRoom: boolean }], cancel: [job: PanelJob], retry: [jobId: string], choose: [id: string], compare: [id: string], crop: [crop: Crop | null] }>()
const t = ko.studio.illustrate
const n = useLocalStorage('toonflow:studio:candidates', CANDIDATE_DEFAULT)
const leaveRoom = useLocalStorage('toonflow:studio:leaveRoom', true)
const extra = ref('')
const busy = computed(() => !!props.job && ACTIVE_STATUSES.includes(props.job.status))
const failed = computed(() => props.job?.status === 'failed')

const zoom = ref(1)
const cx = ref(0.5)
const cy = ref(0.5)
watch(() => props.cut.panel.id, () => {
  const c = props.cut.panel.crop
  zoom.value = c ? 1 / c.w : 1
  cx.value = c && c.w < 1 ? c.x / (1 - c.w) : 0.5
  cy.value = c && c.h < 1 ? c.y / (1 - c.h) : 0.5
  extra.value = ''
}, { immediate: true })
const saveCrop = useDebounceFn(() => emit('crop', zoom.value <= 1 ? null : zoomCrop(zoom.value, cx.value, cy.value)), 400)
function resetCrop() {
  zoom.value = 1
  cx.value = 0.5
  cy.value = 0.5
  emit('crop', null)
}
const has = computed(() => props.candidates.length > 0)
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="failed" class="bg-destructive/10 text-destructive flex flex-col gap-1 rounded-md px-2 py-1.5 text-xs" role="alert">
      <span class="font-medium">{{ t.failed }}</span>
      <span>{{ t.errors[job!.error?.code ?? 'internal'] }}</span>
      <button v-if="edit && job!.error?.code !== 'policy_rejected'" class="self-start underline" @click="emit('retry', job!.id)">{{ ko.studio.retry }}</button>
    </div>

    <details class="rounded-md border px-2 py-1.5 text-xs">
      <summary class="cursor-pointer font-medium">{{ t.input }}</summary>
      <dl class="mt-1.5 flex flex-col gap-1">
        <dt class="text-muted-foreground">{{ t.style }}</dt>
        <dd>{{ styleName || t.noStyle }}</dd>
        <dt class="text-muted-foreground">{{ t.characters }}</dt>
        <dd>{{ characterNames.join(', ') || t.noCharacters }}</dd>
        <dt class="text-muted-foreground">{{ t.prompt }}</dt>
        <dd class="bg-muted max-h-40 overflow-y-auto rounded p-1.5 whitespace-pre-wrap">{{ promptOf({ extra, leaveRoom }) }}</dd>
      </dl>
    </details>

    <template v-if="edit">
      <div class="flex flex-col gap-1">
        <Label for="ill-extra" class="text-xs">{{ t.extra }}</Label>
        <Input id="ill-extra" v-model="extra" :placeholder="t.extraPh" maxlength="200" />
      </div>
      <label class="flex items-center gap-2 text-xs"><input v-model="leaveRoom" type="checkbox"> {{ t.leaveRoom }}</label>
      <p class="text-muted-foreground text-xs">{{ t.noText }}</p>
      <div class="flex items-center gap-2">
        <select v-model.number="n" class="border-input bg-card h-9 rounded-md border px-2 text-sm" :aria-label="t.count">
          <option v-for="i in 4" :key="i" :value="i">{{ i }}</option>
        </select>
        <Button class="flex-1" size="sm" :disabled="busy" @click="emit('generate', n, { extra, leaveRoom })">
          <Sparkles class="size-4" /> {{ (has ? t.regenerate : t.generate)(n, estimate(n)) }}
        </Button>
      </div>
    </template>
    <div v-if="busy" class="text-muted-foreground flex items-center gap-2 text-xs">
      <Loader2 class="size-3.5 animate-spin" /> {{ job!.status === 'queued' ? t.queued : t.running }}
      <button v-if="edit" class="ml-auto flex items-center gap-0.5 underline" @click="emit('cancel', job!)"><X class="size-3" />{{ t.cancel }}</button>
    </div>

    <div class="flex flex-col gap-1.5">
      <span class="text-sm font-medium">{{ t.candidates }} <span class="text-muted-foreground text-xs">{{ candidates.length }}</span></span>
      <p v-if="!has" class="text-muted-foreground text-xs">{{ t.noCandidates }}</p>
      <div class="grid grid-cols-2 gap-2">
        <div v-for="c in candidates" :key="c.id" class="group relative overflow-hidden rounded-md border" :class="{ 'ring-primary ring-2': c.id === cut.panel.selectedCandidateId }">
          <button class="block w-full" :aria-label="t.choose" :disabled="!edit" @click="emit('choose', c.id)">
            <AppStorageImg :path="c.imagePath" class="aspect-[4/5] w-full" />
          </button>
          <button class="bg-card absolute top-1 right-1 rounded p-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100" :aria-label="t.compare" :title="t.compare" @click="emit('compare', c.id)">
            <Columns2 class="size-3.5" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="cut.panel.selectedCandidateId && edit" class="flex flex-col gap-1.5 border-t pt-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">{{ t.crop }}</span>
        <button class="text-muted-foreground flex items-center gap-0.5 text-xs underline" @click="resetCrop"><RotateCcw class="size-3" />{{ t.resetCrop }}</button>
      </div>
      <label class="flex items-center gap-2 text-xs">{{ t.zoom }}<input v-model.number="zoom" type="range" min="1" max="3" step="0.05" class="flex-1" @input="saveCrop"></label>
      <label class="flex items-center gap-2 text-xs">{{ t.x }}<input v-model.number="cx" type="range" min="0" max="1" step="0.01" class="flex-1" :disabled="zoom <= 1" @input="saveCrop"></label>
      <label class="flex items-center gap-2 text-xs">{{ t.y }}<input v-model.number="cy" type="range" min="0" max="1" step="0.01" class="flex-1" :disabled="zoom <= 1" @input="saveCrop"></label>
    </div>
  </div>
</template>
