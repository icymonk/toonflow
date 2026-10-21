<script setup lang="ts">
import type { Character, CharacterInput, CharacterVariant } from '#shared/library'
import type { Library } from '~/composables/useLibrary'
import { Archive, Check, Loader2, Sparkles, Trash2, X } from '@lucide/vue'
import { watchDebounced } from '@vueuse/core'
import { toast } from 'vue-sonner'
import { APPEARANCE_KEYS, APPEARANCE_LABEL, characterInput, characterPrompt, CONSISTENCY_SCENES, describeAppearance, emptyAppearance, SHEET, withHint } from '#shared/library'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

// CHR-01·02·04·09·11
const props = defineProps<{ character: Character, edit: boolean }>()
const emit = defineEmits<{ removed: [] }>()
const lib = inject<Library>('lib')!
const t = ko.library
const fail = (e: unknown) => toast.error(errorMessage(e) ?? ko.errors.unknown)

const c = props.character
const form = reactive<CharacterInput>({
  name: c.name, aliases: [...c.aliases], intro: c.intro, personality: c.personality ?? '', speech: [...(c.speech ?? [])],
  appearance: { ...emptyAppearance(), ...c.appearance }, appearanceText: c.appearanceText, episodeId: c.episodeId,
})
const aliases = ref(props.character.aliases.join(', '))
const speech = ref((props.character.speech ?? []).join('\n'))
watchDebounced([form, aliases, speech], () => {
  form.aliases = aliases.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5)
  form.speech = speech.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 3)
  const p = characterInput.safeParse(form)
  if (p.success) lib.update('characters', props.character.id, p.data).catch(fail)
}, { debounce: 800, deep: true })

const refs = computed(() => props.character.refImages ?? [])
async function upload(file: File) {
  try {
    const path = await lib.upload('characters', props.character.id, file)
    await lib.update('characters', props.character.id, { refImages: [...refs.value, path], coverPath: props.character.coverPath ?? path })
  }
  catch (e) { fail(e) }
}
async function removeRef(path: string) {
  const rest = refs.value.filter(p => p !== path)
  await lib.update('characters', props.character.id, { refImages: rest, coverPath: props.character.coverPath === path ? (rest[0] ?? null) : props.character.coverPath }).catch(fail)
  await lib.removeFile(path)
}
const setCover = (path: string) => lib.update('characters', props.character.id, { coverPath: path }).catch(fail)

// CHR-04 생성: 그림체를 적용한 후보 2개에서 고르기
const styleId = ref(lib.series.value.find(s => s.mainCharacterIds?.includes(props.character.id) && s.styleId)?.styleId ?? lib.styles.value[0]?.id ?? '')
const jobId = ref<string | null>(null)
const job = lib.watchJob(jobId)
// 올린 사진(참조 이미지)을 앞에, 그림체 그림은 남는 칸에. 프롬프트에 사진 수를 알린다
const refPathsFor = (style: { refImages?: string[] } | null) => [...refs.value, ...(style?.refImages ?? [])].slice(0, 5)
const photoCount = () => Math.min(refs.value.length, 5)
async function generate() {
  const style = lib.styles.value.find(s => s.id === styleId.value) ?? null
  try {
    const out = await lib.generate({ characterId: props.character.id }, { prompt: characterPrompt(form, style, photoCount()), n: 2, negative: style?.negative || undefined, refPaths: refPathsFor(style) })
    jobId.value = out.jobId
  }
  catch (e) { fail(e) }
}
const addCandidate = (path: string) => (refs.value.includes(path) || refs.value.length >= 5 ? undefined : lib.update('characters', props.character.id, { refImages: [...refs.value, path], coverPath: props.character.coverPath ?? path }).catch(fail))
// CHR-04 미리보기: 누르면 고르기(참조 이미지 + 대표), 다시 누르면 빼기, ×는 목록에서 지우기
const hidden = ref(new Set<string>())
const shown = (paths?: string[]) => (paths ?? []).filter(p => !hidden.value.has(p))
const unpick = (path: string) => {
  const rest = refs.value.filter(p => p !== path)
  return lib.update('characters', props.character.id, { refImages: rest, coverPath: props.character.coverPath === path ? (rest[0] ?? null) : props.character.coverPath }).catch(fail)
}
async function togglePick(path: string) {
  if (refs.value.includes(path)) return unpick(path)
  if (refs.value.length >= 5) return toast.error(t.refsFull)
  await lib.update('characters', props.character.id, { refImages: [...refs.value, path], coverPath: path }).catch(fail)
}
async function dismiss(path: string) {
  hidden.value = new Set([...hidden.value, path])
  if (refs.value.includes(path)) await unpick(path)
}

// CHR-05 시트 · CHR-12 일관성 테스트
const multiKind = ref<'sheet' | 'consistency' | null>(null)
const multiJobId = ref<string | null>(null)
const multiJob = lib.watchJob(multiJobId)
const busy = computed(() => multiJob.value?.status === 'queued' || multiJob.value?.status === 'running')
async function generateMany(kind: 'sheet' | 'consistency') {
  const style = lib.styles.value.find(s => s.id === styleId.value) ?? null
  const base = characterPrompt(form, style, photoCount())
  const prompts = kind === 'sheet' ? SHEET.map(s => withHint(base, s.hint, true)) : CONSISTENCY_SCENES.map(h => withHint(base, h))
  try {
    const out = await lib.generate({ characterId: props.character.id }, { prompts, negative: style?.negative || undefined, refPaths: refPathsFor(style) })
    multiKind.value = kind
    multiJobId.value = out.jobId
  }
  catch (e) { fail(e) }
}
// CHR-06 표정·의상
const variants = computed(() => props.character.variants ?? [])
const addVariant = (v: CharacterVariant) => (variants.value.length >= 12 || variants.value.some(x => x.path === v.path) ? undefined : lib.update('characters', props.character.id, { variants: [...variants.value, v] }).catch(fail))
const removeVariant = (path: string) => lib.update('characters', props.character.id, { variants: variants.value.filter(v => v.path !== path) }).catch(fail)
function keepSheet(i: number, path: string) {
  const s = SHEET[i]
  if (!s) return
  if (s.kind === 'view') return addCandidate(path)
  return addVariant({ kind: 'expression', label: s.label, path })
}
const vKind = ref<CharacterVariant['kind']>('expression')
const vLabel = ref('')
async function uploadVariant(file: File) {
  if (!vLabel.value.trim()) return toast.error(t.variantLabelNeeded)
  try {
    await addVariant({ kind: vKind.value, label: vLabel.value.trim().slice(0, 20), path: await lib.upload('characters', props.character.id, file) })
    vLabel.value = ''
  }
  catch (e) { fail(e) }
}
// CHR-08 등장 기록
const appearances = ref<{ episodeId: string, title: string, panels: number }[] | null>(null)
async function loadAppearances() {
  appearances.value = await lib.appearances(props.character.id).catch(() => [])
}

const archive = () => lib.update('characters', props.character.id, { archivedAt: props.character.archivedAt ? null : new Date() }).catch(fail)
async function remove() {
  if (!await confirmDialog(t.removeConfirm)) return
  await lib.remove('characters', props.character.id).then(() => emit('removed'), fail)
}
const selectClass = 'border-input bg-card h-9 rounded-md border px-2 text-sm'
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-1.5">
      <Label for="c-name">{{ t.name }}</Label>
      <Input id="c-name" v-model="form.name" :disabled="!edit" maxlength="30" />
    </div>
    <div class="flex flex-col gap-1.5">
      <Label for="c-aliases" class="text-xs">{{ t.aliases }}</Label>
      <Input id="c-aliases" v-model="aliases" :disabled="!edit" />
    </div>
    <div class="flex flex-col gap-1.5">
      <Label for="c-intro" class="text-xs">{{ t.intro }}</Label>
      <Input id="c-intro" v-model="form.intro" :disabled="!edit" maxlength="100" />
    </div>
    <div class="flex flex-col gap-1.5">
      <Label for="c-persona" class="text-xs">{{ t.personality }}</Label>
      <Input id="c-persona" v-model="form.personality" :disabled="!edit" maxlength="100" />
      <Label for="c-speech" class="text-xs">{{ t.speech }}</Label>
      <Textarea id="c-speech" v-model="speech" rows="3" :disabled="!edit" />
    </div>
    <p v-if="character.episodeId" class="text-muted-foreground text-xs">
      {{ t.episodeOnly }}
    </p>

    <fieldset class="flex flex-col gap-2">
      <legend class="mb-1 text-sm font-medium">
        {{ t.appearance }}
      </legend>
      <div class="grid grid-cols-2 gap-2">
        <div v-for="k in APPEARANCE_KEYS" :key="k" class="flex flex-col gap-1">
          <Label :for="`c-${k}`" class="text-xs">{{ APPEARANCE_LABEL[k] }}</Label>
          <Input :id="`c-${k}`" v-model="form.appearance[k]" :disabled="!edit" maxlength="60" />
        </div>
      </div>
      <div class="flex items-center justify-between">
        <Label for="c-text" class="text-xs">{{ t.appearanceText }}</Label>
        <Button v-if="edit" size="sm" variant="ghost" @click="form.appearanceText = describeAppearance(form.appearance)">
          {{ t.autoText }}
        </Button>
      </div>
      <Textarea id="c-text" v-model="form.appearanceText" :placeholder="describeAppearance(form.appearance)" :disabled="!edit" rows="3" maxlength="600" />
    </fieldset>

    <div v-if="lib.series.value.length" class="flex flex-col gap-1.5">
      <span class="text-sm font-medium">{{ t.mainIn }}</span>
      <label v-for="s in lib.series.value" :key="s.id" class="flex items-center gap-2 text-sm">
        <AppCheck :model-value="s.mainCharacterIds?.includes(character.id)" :disabled="!edit" @change="lib.setMain(s.id, character.id, $event).catch(fail)" />
        {{ s.name }}
      </label>
    </div>

    <div class="flex flex-col gap-2">
      <span class="text-sm font-medium">{{ t.refImages }}</span>
      <LibraryRefImages :paths="refs" :cover="character.coverPath" :edit="edit" @upload="upload" @remove="removeRef" @cover="setCover" />
      <div v-if="edit" class="flex flex-col gap-1.5 rounded-md border p-2">
        <Label for="c-style" class="text-xs">{{ t.styleFor }}</Label>
        <AppSelect id="c-style" v-model="styleId" :class="selectClass">
          <option value="">
            {{ t.noStyle }}
          </option>
          <option v-for="s in lib.styles.value" :key="s.id" :value="s.id">
            {{ s.name }}
          </option>
        </AppSelect>
        <Button size="sm" variant="outline" :disabled="job?.status === 'queued' || job?.status === 'running'" @click="generate">
          <Sparkles class="size-4" /> {{ t.generate(2, lib.estimate(2)) }}
        </Button>
        <p v-if="job && (job.status === 'queued' || job.status === 'running')" class="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Loader2 class="size-3.5 animate-spin" /> {{ t.generating }}
        </p>
        <p v-else-if="job?.status === 'failed'" class="text-destructive text-xs">
          {{ t.failed }}
        </p>
        <template v-else-if="job?.status === 'succeeded' && shown(job.providerResult).length">
          <span class="text-muted-foreground text-xs">{{ t.candidates }}</span>
          <div class="grid grid-cols-2 gap-2 p-1">
            <div v-for="p in shown(job.providerResult)" :key="p" class="relative overflow-hidden rounded-md border" :class="{ 'ring-primary ring-2': refs.includes(p) }">
              <button class="block w-full" :aria-pressed="refs.includes(p)" :aria-label="refs.includes(p) ? t.unpick : t.pick" @click="togglePick(p)">
                <AppStorageImg :path="p" class="aspect-[4/5] w-full" />
              </button>
              <span v-if="refs.includes(p)" class="bg-primary text-primary-foreground absolute bottom-1 left-1 flex items-center gap-0.5 rounded px-1 text-[11px]"><Check class="size-3" />{{ t.picked }}</span>
              <button class="bg-background/90 hover:bg-background absolute top-1 right-1 flex size-6 items-center justify-center rounded-full border" :aria-label="t.dismiss" :title="t.dismiss" @click="dismiss(p)">
                <X class="size-3.5" />
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <span class="text-sm font-medium">{{ t.variants }}</span>
      <div v-if="variants.length" class="grid grid-cols-3 gap-2">
        <div v-for="v in variants" :key="v.path" class="relative overflow-hidden rounded-md border">
          <AppStorageImg :path="v.path" class="aspect-[4/5] w-full" />
          <span class="bg-background/80 absolute bottom-0 left-0 px-1 text-[11px]">{{ t.variantKinds[v.kind] }} · {{ v.label }}</span>
          <button v-if="edit" class="bg-background/80 absolute top-0 right-0 px-1 text-xs" :aria-label="t.remove" @click="removeVariant(v.path)">×</button>
        </div>
      </div>
      <p v-else class="text-muted-foreground text-xs">{{ t.variantsHint }}</p>
      <div v-if="edit" class="flex items-center gap-1.5">
        <AppSelect v-model="vKind" :class="selectClass" :aria-label="t.variants">
          <option value="expression">{{ t.variantKinds.expression }}</option>
          <option value="outfit">{{ t.variantKinds.outfit }}</option>
        </AppSelect>
        <Input v-model="vLabel" class="h-8" maxlength="20" :placeholder="t.variantLabel" />
        <label class="hover:bg-muted shrink-0 cursor-pointer rounded-md border px-2 py-1 text-xs">{{ t.uploadVariant }}<input type="file" accept="image/*" class="hidden" @change="(e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) uploadVariant(f); (e.target as HTMLInputElement).value = '' }"></label>
      </div>
      <div v-if="edit" class="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" :loading="busy" @click="generateMany('sheet')">
          <Sparkles class="size-4" /> {{ t.sheet(lib.estimate(6)) }}
        </Button>
        <Button size="sm" variant="outline" :loading="busy" @click="generateMany('consistency')">
          <Sparkles class="size-4" /> {{ t.consistency(lib.estimate(4)) }}
        </Button>
      </div>
      <p v-if="busy" class="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Loader2 class="size-3.5 animate-spin" /> {{ t.generating }}
      </p>
      <p v-else-if="multiJob?.status === 'failed'" class="text-destructive text-xs">
        {{ t.failed }}
      </p>
      <template v-else-if="multiJob?.status === 'succeeded' && shown(multiJob.providerResult).length">
        <span class="text-muted-foreground text-xs">{{ multiKind === 'sheet' ? t.sheetPick : t.consistencyHint }}</span>
        <div class="grid gap-2" :class="multiKind === 'sheet' ? 'grid-cols-3' : 'grid-cols-2'">
          <template v-for="(p, i) in multiJob.providerResult" :key="p">
            <div v-if="!hidden.has(p)" class="relative overflow-hidden rounded-md border">
              <button class="block w-full" :disabled="multiKind !== 'sheet'" @click="keepSheet(i, p)">
                <AppStorageImg :path="p" class="aspect-[4/5] w-full" />
              </button>
              <span class="bg-background/80 absolute bottom-0 left-0 px-1 text-[11px]">{{ multiKind === 'sheet' ? SHEET[i]?.label : CONSISTENCY_SCENES[i] }}</span>
              <button class="bg-background/90 hover:bg-background absolute top-1 right-1 flex size-6 items-center justify-center rounded-full border" :aria-label="t.dismiss" :title="t.dismiss" @click="dismiss(p)">
                <X class="size-3.5" />
              </button>
            </div>
          </template>
        </div>
      </template>
    </div>

    <div class="flex flex-col gap-1.5">
      <button class="self-start text-sm font-medium underline-offset-2 hover:underline" @click="loadAppearances">{{ t.appearances }}</button>
      <p v-if="appearances && !appearances.length" class="text-muted-foreground text-xs">{{ t.noAppearances }}</p>
      <NuxtLink v-for="a in appearances ?? []" :key="a.episodeId" class="text-sm underline" :to="`/studio?episode=${a.episodeId}&step=storyboard`">{{ a.title }} · {{ t.panelCount(a.panels) }}</NuxtLink>
    </div>

    <div v-if="edit" class="flex gap-2 border-t pt-3">
      <Button size="sm" variant="outline" @click="archive">
        <Archive class="size-4" /> {{ character.archivedAt ? t.unarchive : t.archive }}
      </Button>
      <Button size="sm" variant="ghost" @click="remove">
        <Trash2 class="size-4" /> {{ t.remove }}
      </Button>
    </div>
  </div>
</template>
