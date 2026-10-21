<script setup lang="ts">
import type { Adjust } from '#shared/studio'
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
  library?: { id: string, path: string }[]
  job?: PanelJob
  styleName: string
  characterNames: string[]
  promptOf: (o: { extra: string, leaveRoom: boolean }) => string
  estimate: (n: number) => number
  edit: boolean
}>()
const emit = defineEmits<{ generate: [n: number, opts: { extra: string, leaveRoom: boolean }], cancel: [job: PanelJob], retry: [jobId: string], choose: [id: string], compare: [id: string], crop: [crop: Crop | null], flag: [id: string, patch: { favorite?: boolean, hidden?: boolean }], variant: [id: string], upload: [file: File], import: [path: string], inpaint: [id: string, mask: Blob, change: string], adjust: [a: Adjust | null] }>()
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
// ILL-24 밝기·색 보정
const NO_ADJUST = { brightness: 100, contrast: 100, saturate: 100 }
const ADJUST_KEYS = ['brightness', 'contrast', 'saturate'] as const
const adj = reactive({ ...NO_ADJUST })
watch(() => props.cut.panel.adjust, a => Object.assign(adj, a ?? NO_ADJUST), { immediate: true })
const saveAdjust = useDebounceFn(() => emit('adjust', ADJUST_KEYS.every(k => adj[k] === 100) ? null : { ...adj }), 400)
function resetAdjust() {
  Object.assign(adj, NO_ADJUST)
  emit('adjust', null)
}
function resetCrop() {
  zoom.value = 1
  cx.value = 0.5
  cy.value = 0.5
  emit('crop', null)
}
const has = computed(() => props.candidates.length > 0)
// ILL-14: 별표 먼저, 숨긴 후보는 접어 둔다
const showHidden = ref(false)
const picking = ref(false)
const maskId = ref<string | null>(null)
const maskPath = computed(() => props.candidates.find(c => c.id === maskId.value)?.imagePath)
function onMask(mask: Blob, change: string) {
  if (maskId.value) emit('inpaint', maskId.value, mask, change)
  maskId.value = null
}
const hiddenCount = computed(() => props.candidates.filter(c => c.hidden).length)
const shown = computed(() => props.candidates.filter(c => showHidden.value || !c.hidden || c.id === props.cut.panel.selectedCandidateId).sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite)))
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="failed" class="bg-destructive/10 text-destructive flex flex-col gap-1 rounded-md px-2 py-1.5 text-xs" role="alert">
      <span class="font-medium">{{ t.failed }}</span>
      <span>{{ t.errors[job!.error?.code ?? 'internal'] }}</span>
      <span v-if="job!.error?.code === 'policy_rejected'" class="basis-full">{{ t.policyTips }}</span>
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
      <label class="flex items-center gap-2 text-xs"><AppCheck v-model="leaveRoom" /> {{ t.leaveRoom }}</label>
      <p class="text-muted-foreground text-xs">{{ t.noText }}</p>
      <div class="flex items-center gap-2">
        <AppSelect v-model.number="n" class="border-input bg-card h-9 rounded-md border px-2 text-sm" :aria-label="t.count">
          <option v-for="i in 4" :key="i" :value="i">{{ i }}</option>
        </AppSelect>
        <Button class="flex-1" size="sm" :loading="busy" @click="emit('generate', n, { extra, leaveRoom })">
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
      <label v-if="edit" class="hover:bg-muted cursor-pointer self-start rounded border px-2 py-0.5 text-xs">{{ t.uploadCandidate }}<input type="file" accept="image/*" class="hidden" @change="e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) emit('upload', f); (e.target as HTMLInputElement).value = '' }"></label>
      <button v-if="edit && library?.length" class="hover:bg-muted self-start rounded border px-2 py-0.5 text-xs" @click="picking = !picking">{{ t.importCandidate }}</button>
      <div v-if="picking" class="grid max-h-60 grid-cols-3 gap-1 overflow-y-auto rounded border p-1">
        <button v-for="l in library" :key="l.id" @click="emit('import', l.path); picking = false"><AppStorageImg :path="l.path" class="aspect-[4/5] w-full" /></button>
      </div>
      <button v-if="hiddenCount" class="text-muted-foreground self-start text-xs underline" @click="showHidden = !showHidden">{{ showHidden ? t.hideHidden : t.showHidden(hiddenCount) }}</button>
      <div class="grid grid-cols-2 gap-2 p-1">
        <div v-for="c in shown" :key="c.id" class="group relative overflow-hidden rounded-md border" :class="{ 'ring-primary ring-2': c.id === cut.panel.selectedCandidateId }">
          <button class="block w-full" :aria-label="t.choose" :disabled="!edit" @click="emit('choose', c.id)">
            <AppStorageImg :path="c.imagePath" class="aspect-[4/5] w-full" />
          </button>
          <button class="bg-card absolute top-1 right-1 rounded p-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100" :aria-label="t.compare" :title="t.compare" @click="emit('compare', c.id)">
            <Columns2 class="size-3.5" />
          </button>
          <div v-if="edit" class="absolute top-1 left-1 flex gap-0.5">
            <button class="bg-card rounded px-1 text-xs" :class="c.favorite ? 'text-amber-500' : 'opacity-0 group-hover:opacity-100'" :aria-label="t.favorite" :title="t.favorite" @click="emit('flag', c.id, { favorite: !c.favorite })">★</button>
            <button class="bg-card rounded px-1 text-xs opacity-0 group-hover:opacity-100" :aria-label="c.hidden ? t.unhide : t.hide" :title="c.hidden ? t.unhide : t.hide" @click="emit('flag', c.id, { hidden: !c.hidden })">{{ c.hidden ? t.unhide : t.hide }}</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="cut.panel.selectedCandidateId && edit" class="flex flex-col gap-1.5 border-t pt-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">{{ t.crop }}</span>
        <button class="text-muted-foreground flex items-center gap-0.5 text-xs underline" @click="resetCrop"><RotateCcw class="size-3" />{{ t.resetCrop }}</button>
      </div>
      <div class="flex items-center gap-1 text-xs">
        <span class="text-muted-foreground">{{ t.editWith }}</span>
        <Button size="sm" variant="outline" @click="emit('variant', cut.panel.selectedCandidateId!)">{{ t.variant }}</Button>
        <Button size="sm" variant="outline" @click="maskId = cut.panel.selectedCandidateId!">{{ t.inpaint }}</Button>
      </div>
      <label class="flex items-center gap-2 text-xs">{{ t.zoom }}<AppSlider v-model="zoom" min="1" max="3" step="0.05" class="flex-1" @input="saveCrop" /></label>
      <label class="flex items-center gap-2 text-xs">{{ t.x }}<AppSlider v-model="cx" min="0" max="1" step="0.01" class="flex-1" :disabled="zoom <= 1" @input="saveCrop" /></label>
      <label class="flex items-center gap-2 text-xs">{{ t.y }}<AppSlider v-model="cy" min="0" max="1" step="0.01" class="flex-1" :disabled="zoom <= 1" @input="saveCrop" /></label>
      <div class="flex items-center justify-between pt-2">
        <span class="text-sm font-medium">{{ t.adjust }}</span>
        <button class="text-muted-foreground flex items-center gap-0.5 text-xs underline" @click="resetAdjust"><RotateCcw class="size-3" />{{ t.resetAdjust }}</button>
      </div>
      <label v-for="k in ADJUST_KEYS" :key="k" class="flex items-center gap-2 text-xs">{{ t[k] }}<AppSlider v-model="adj[k]" min="50" max="150" step="1" class="flex-1" :aria-label="t[k]" @input="saveAdjust" /><span class="w-8 text-right tabular-nums">{{ adj[k] }}</span></label>
    </div>
    <StudioMaskEditor v-if="maskPath" :path="maskPath" @close="maskId = null" @done="onMask" />
  </div>
</template>
