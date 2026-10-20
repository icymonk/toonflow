<script setup lang="ts">
import type { Style, StyleInput } from '#shared/library'
import type { Library } from '~/composables/useLibrary'
import { Archive, Loader2, Sparkles, Trash2 } from '@lucide/vue'
import { watchDebounced } from '@vueuse/core'
import { toast } from 'vue-sonner'
import { BACKGROUNDS, COLORINGS, LINES, PALETTES, styleInput, stylePrompts } from '#shared/library'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

// STL-01·02·04·09
const props = defineProps<{ style: Style, edit: boolean }>()
const emit = defineEmits<{ removed: [] }>()
const lib = inject<Library>('lib')!
const t = ko.library
const fail = (e: unknown) => toast.error(errorMessage(e) ?? ko.errors.unknown)

const pick = (s: Style): StyleInput => ({ name: s.name, description: s.description, line: s.line, coloring: s.coloring, palette: s.palette, paletteColors: s.paletteColors, background: s.background, negative: s.negative, rightsConfirmed: s.rightsConfirmed })
const form = reactive<StyleInput>(pick(props.style))
watchDebounced(form, () => {
  const p = styleInput.safeParse(form)
  if (p.success) lib.update('styles', props.style.id, { ...p.data, version: (props.style.version ?? 1) + 1 }).catch(fail)
}, { debounce: 800, deep: true })

const refs = computed(() => props.style.refImages ?? [])
async function upload(file: File) {
  try {
    const path = await lib.upload('styles', props.style.id, file)
    await lib.update('styles', props.style.id, { refImages: [...refs.value, path] })
  }
  catch (e) { fail(e) }
}
async function removeRef(path: string) {
  await lib.update('styles', props.style.id, { refImages: refs.value.filter(p => p !== path) }).catch(fail)
  await lib.removeFile(path)
}

// STL-04 미리 보기 3장
const jobId = ref<string | null>(null)
const job = lib.watchJob(jobId)
const busy = computed(() => job.value?.status === 'queued' || job.value?.status === 'running')
async function samples() {
  try {
    const out = await lib.generate({ styleId: props.style.id }, { prompts: stylePrompts(form), negative: form.negative || undefined, refPaths: refs.value })
    jobId.value = out.jobId
  }
  catch (e) { fail(e) }
}

const archive = () => lib.update('styles', props.style.id, { archivedAt: props.style.archivedAt ? null : new Date() }).catch(fail)
async function remove() {
  if (!await confirmDialog(t.removeConfirm)) return
  await lib.remove('styles', props.style.id).then(() => emit('removed'), fail)
}
const selectClass = 'border-input bg-card h-9 rounded-md border px-2 text-sm disabled:opacity-50'
const enums = [
  { key: 'line', list: LINES, label: t.line, names: t.lines },
  { key: 'coloring', list: COLORINGS, label: t.coloring, names: t.colorings },
  { key: 'palette', list: PALETTES, label: t.palette, names: t.palettes },
  { key: 'background', list: BACKGROUNDS, label: t.background, names: t.backgrounds },
] as const
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-1.5">
      <Label for="s-name">{{ t.name }} <span class="text-muted-foreground text-xs font-normal">v{{ style.version ?? 1 }}</span></Label>
      <Input id="s-name" v-model="form.name" :disabled="!edit" maxlength="30" />
    </div>
    <div class="flex flex-col gap-1.5">
      <Label for="s-desc" class="text-xs">{{ t.description }}</Label>
      <Textarea id="s-desc" v-model="form.description" :disabled="!edit" rows="3" maxlength="500" />
    </div>
    <div class="grid grid-cols-2 gap-2">
      <div v-for="e in enums" :key="e.key" class="flex flex-col gap-1">
        <Label :for="`s-${e.key}`" class="text-xs">{{ e.label }}</Label>
        <AppSelect :id="`s-${e.key}`" v-model="(form as Record<string, unknown>)[e.key]" :class="selectClass" :disabled="!edit">
          <option v-for="v in e.list" :key="v" :value="v">
            {{ (e.names as Record<string, string>)[v] }}
          </option>
        </AppSelect>
      </div>
    </div>
    <div v-if="form.palette === 'custom'" class="flex flex-col gap-1">
      <Label for="s-colors" class="text-xs">{{ t.paletteColors }}</Label>
      <Input id="s-colors" v-model="form.paletteColors" :disabled="!edit" maxlength="100" />
    </div>
    <div class="flex flex-col gap-1">
      <Label for="s-neg" class="text-xs">{{ t.negative }}</Label>
      <Input id="s-neg" v-model="form.negative" :disabled="!edit" maxlength="300" />
    </div>

    <div class="flex flex-col gap-2">
      <span class="text-sm font-medium">{{ t.refImages }}</span>
      <label class="flex items-center gap-2 text-xs">
        <AppCheck v-model="form.rightsConfirmed" :disabled="!edit" /> {{ t.rights }}
      </label>
      <LibraryRefImages :paths="refs" :edit="edit" :locked="!form.rightsConfirmed" @upload="upload" @remove="removeRef" />
    </div>

    <div class="flex flex-col gap-2">
      <span class="text-sm font-medium">{{ t.samplesTitle }}</span>
      <div v-if="style.samples?.length" class="grid grid-cols-3 gap-2">
        <AppStorageImg v-for="p in style.samples" :key="p" :path="p" class="aspect-[4/5] w-full rounded-md border" />
      </div>
      <p v-else class="text-muted-foreground text-xs">
        {{ t.noSamples }}
      </p>
      <p v-if="busy" class="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Loader2 class="size-3.5 animate-spin" /> {{ t.generating }}
      </p>
      <p v-else-if="job?.status === 'failed'" class="text-destructive text-xs">
        {{ t.failed }}
      </p>
      <Button v-if="edit" size="sm" variant="outline" :loading="busy" @click="samples">
        <Sparkles class="size-4" /> {{ t.samples(lib.estimate(3)) }}
      </Button>
    </div>

    <div v-if="lib.series.value.length" class="flex flex-col gap-1.5">
      <span class="text-sm font-medium">{{ t.usedIn }}</span>
      <label v-for="s in lib.series.value" :key="s.id" class="flex items-center gap-2 text-sm">
        <AppCheck :model-value="s.styleId === style.id" :disabled="!edit" @change="lib.setSeriesStyle(s.id, $event ? style.id : null).catch(fail)" />
        {{ s.name }}
      </label>
    </div>

    <div v-if="edit" class="flex gap-2 border-t pt-3">
      <Button size="sm" variant="outline" @click="archive">
        <Archive class="size-4" /> {{ style.archivedAt ? t.unarchive : t.archive }}
      </Button>
      <Button size="sm" variant="ghost" @click="remove">
        <Trash2 class="size-4" /> {{ t.remove }}
      </Button>
    </div>
  </div>
</template>
