<script setup lang="ts">
import type { Character, CharacterInput } from '#shared/library'
import type { Library } from '~/composables/useLibrary'
import { Archive, Loader2, Sparkles, Trash2 } from '@lucide/vue'
import { watchDebounced } from '@vueuse/core'
import { toast } from 'vue-sonner'
import { APPEARANCE_KEYS, APPEARANCE_LABEL, characterInput, characterPrompt, describeAppearance } from '#shared/library'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

// CHR-01·02·04·09·11
const props = defineProps<{ character: Character, edit: boolean }>()
const emit = defineEmits<{ removed: [] }>()
const lib = inject<Library>('lib')!
const t = ko.library
const fail = (e: unknown) => toast.error(errorMessage(e) ?? ko.errors.unknown)

const form = reactive<CharacterInput>(structuredClone(toRaw({ ...props.character, aliases: [...props.character.aliases] })))
const aliases = ref(props.character.aliases.join(', '))
watchDebounced([form, aliases], () => {
  form.aliases = aliases.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5)
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
async function generate() {
  const style = lib.styles.value.find(s => s.id === styleId.value) ?? null
  try {
    const out = await lib.generate({ characterId: props.character.id }, { prompt: characterPrompt(form, style), n: 2, negative: style?.negative || undefined, refPaths: [...(style?.refImages ?? []), ...refs.value].slice(0, 5) })
    jobId.value = out.jobId
  }
  catch (e) { fail(e) }
}
const addCandidate = (path: string) => (refs.value.includes(path) || refs.value.length >= 5 ? undefined : lib.update('characters', props.character.id, { refImages: [...refs.value, path], coverPath: props.character.coverPath ?? path }).catch(fail))

const archive = () => lib.update('characters', props.character.id, { archivedAt: props.character.archivedAt ? null : new Date() }).catch(fail)
async function remove() {
  if (!window.confirm(t.removeConfirm)) return
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
        <input type="checkbox" :checked="s.mainCharacterIds?.includes(character.id)" :disabled="!edit" @change="lib.setMain(s.id, character.id, ($event.target as HTMLInputElement).checked).catch(fail)">
        {{ s.name }}
      </label>
    </div>

    <div class="flex flex-col gap-2">
      <span class="text-sm font-medium">{{ t.refImages }}</span>
      <LibraryRefImages :paths="refs" :cover="character.coverPath" :edit="edit" @upload="upload" @remove="removeRef" @cover="setCover" />
      <div v-if="edit" class="flex flex-col gap-1.5 rounded-md border p-2">
        <Label for="c-style" class="text-xs">{{ t.styleFor }}</Label>
        <select id="c-style" v-model="styleId" :class="selectClass">
          <option value="">
            {{ t.noStyle }}
          </option>
          <option v-for="s in lib.styles.value" :key="s.id" :value="s.id">
            {{ s.name }}
          </option>
        </select>
        <Button size="sm" variant="outline" :disabled="job?.status === 'queued' || job?.status === 'running'" @click="generate">
          <Sparkles class="size-4" /> {{ t.generate(2, lib.estimate(2)) }}
        </Button>
        <p v-if="job && (job.status === 'queued' || job.status === 'running')" class="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Loader2 class="size-3.5 animate-spin" /> {{ t.generating }}
        </p>
        <p v-else-if="job?.status === 'failed'" class="text-destructive text-xs">
          {{ t.failed }}
        </p>
        <template v-else-if="job?.status === 'succeeded' && job.providerResult?.length">
          <span class="text-muted-foreground text-xs">{{ t.candidates }}</span>
          <div class="grid grid-cols-2 gap-2">
            <button v-for="p in job.providerResult" :key="p" class="overflow-hidden rounded-md border" :class="{ 'ring-primary ring-2': refs.includes(p) }" @click="addCandidate(p)">
              <AppStorageImg :path="p" class="aspect-[4/5] w-full" />
            </button>
          </div>
        </template>
      </div>
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
