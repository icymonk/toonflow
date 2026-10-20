<script setup lang="ts">
import type { RewriteMode, StoryScene, StoryVersion, SuggestField } from '#shared/story'
import { useDebounceFn } from '@vueuse/core'
import { dialoguesToText, REWRITE_MODES, textToDialogues } from '#shared/story'
import { ko } from '~/locales/ko'

// STO-20·22: 가운데 각색안 본문 바로 고치기 (자동 저장)
const props = defineProps<{ version: StoryVersion, active: boolean, edit: boolean, versions: StoryVersion[], rev: number, rewriting: boolean, suggesting: string | null, suggestions: Record<string, string[]> }>()
const emit = defineEmits<{ save: [patch: Partial<Pick<StoryVersion, 'logline' | 'scenes' | 'punchline'>>], activate: [], remake: [], rewrite: [sceneId: string, field: 'beats' | 'dialogues', text: string, mode: RewriteMode, tone: string], compare: [id: string], suggest: [key: string, field: SuggestField, text: string, scene: string] }>()
const t = ko.studio.story

const draft = reactive({ logline: '', punchline: '', scenes: [] as (Omit<StoryScene, 'dialogues'> & { lines: string })[] })
function load(v: StoryVersion) {
  draft.logline = v.logline
  draft.punchline = v.punchline
  draft.scenes = v.scenes.map(s => ({ id: s.id, heading: s.heading, beats: s.beats, lines: dialoguesToText(s.dialogues) }))
}
watch(() => [props.version.id, props.rev], () => load(props.version), { immediate: true })
const others = computed(() => props.versions.filter(v => v.id !== props.version.id))
// STO-13
const field = reactive<Record<string, 'beats' | 'dialogues'>>({})
async function ask(s: (typeof draft.scenes)[number], mode: RewriteMode) {
  const f = field[s.id] ?? 'dialogues'
  const text = f === 'beats' ? s.beats : s.lines
  if (!text.trim()) return
  const tone = mode === 'tone' ? (await promptDialog(t.tonePrompt))?.trim() : ''
  if (tone === undefined || (mode === 'tone' && !tone)) return
  emit('rewrite', s.id, f, text, mode, tone)
}
// 추천 입력: key는 'logline' · 'punchline' · '<장면 id>/heading' · '<장면 id>/beats'
type Scene = (typeof draft.scenes)[number]
const sceneText = (s: Scene) => [s.heading, s.beats, s.lines].filter(Boolean).join('\n')
function want(key: string, f: SuggestField, text: string, s?: Scene) {
  emit('suggest', key, f, text, s ? sceneText(s) : '')
}
function pick(key: string, value: string) {
  if (key === 'logline' || key === 'punchline') draft[key] = value
  else {
    const at = key.lastIndexOf('/')
    const sc = draft.scenes.find(x => x.id === key.slice(0, at))
    const f = key.slice(at + 1)
    if (sc && (f === 'heading' || f === 'beats')) sc[f] = value
  }
  save()
}
const save = useDebounceFn(() => emit('save', {
  logline: draft.logline,
  punchline: draft.punchline,
  scenes: draft.scenes.map(s => ({ id: s.id, heading: s.heading, beats: s.beats, dialogues: textToDialogues(s.lines) })),
}), 800)
</script>

<template>
  <div class="mx-auto flex w-full max-w-2xl flex-col gap-4" @input="save">
    <div class="flex items-center gap-2">
      <h2 class="text-lg font-semibold">
        {{ version.label }}
      </h2>
      <span v-if="active" class="bg-primary text-primary-foreground rounded px-1.5 text-xs">{{ t.active }}</span>
      <div class="ml-auto flex gap-2">
        <select v-if="others.length" class="border-input bg-card h-8 rounded-md border px-2 text-xs" :aria-label="t.compareWith" @change="emit('compare', ($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
          <option value="">{{ t.compare }}</option>
          <option v-for="o in others" :key="o.id" :value="o.id">{{ o.label }}</option>
        </select>
      </div>
      <div v-if="edit" class="flex gap-2">
        <Button size="sm" variant="outline" @click="emit('remake')">
          {{ t.remake }}
        </Button>
        <Button v-if="!active" size="sm" @click="emit('activate')">
          {{ t.useThis }}
        </Button>
      </div>
    </div>
    <div class="flex flex-col gap-1.5">
      <Label for="sv-log">{{ t.logline }}</Label>
      <Input id="sv-log" v-model="draft.logline" :disabled="!edit" />
      <AppSuggest v-if="edit" ai :label="t.logline" :items="suggestions.logline ?? []" :loading="suggesting === 'logline'" :disabled="!!suggesting" @ask="want('logline', 'logline', draft.logline)" @pick="v => pick('logline', v)" />
    </div>
    <Card v-for="(s, i) in draft.scenes" :key="s.id" class="gap-2 py-3">
      <CardContent class="flex flex-col gap-2 px-4">
        <div class="flex items-center gap-2">
          <span class="text-muted-foreground w-14 shrink-0 text-xs">{{ t.scene(i + 1) }}</span>
          <Input v-model="s.heading" :disabled="!edit" :aria-label="t.heading" class="font-medium" />
        </div>
        <AppSuggest v-if="edit" ai :label="`${t.scene(i + 1)} ${t.heading}`" :items="suggestions[`${s.id}/heading`] ?? []" :loading="suggesting === `${s.id}/heading`" :disabled="!!suggesting" @ask="want(`${s.id}/heading`, 'heading', s.heading, s)" @pick="v => pick(`${s.id}/heading`, v)" />
        <Textarea v-model="s.beats" :disabled="!edit" rows="2" :aria-label="t.beats" />
        <AppSuggest v-if="edit" ai :label="`${t.scene(i + 1)} ${t.beats}`" :items="suggestions[`${s.id}/beats`] ?? []" :loading="suggesting === `${s.id}/beats`" :disabled="!!suggesting" @ask="want(`${s.id}/beats`, 'beats', s.beats, s)" @pick="v => pick(`${s.id}/beats`, v)" />
        <Textarea v-model="s.lines" :disabled="!edit" rows="3" :aria-label="t.dialogues" :placeholder="t.dialogues" class="font-mono text-xs" />
        <div v-if="edit" class="flex flex-wrap items-center gap-1 text-xs">
          <span class="text-muted-foreground">{{ t.rewrite }}</span>
          <select v-model="field[s.id]" class="border-input bg-card h-7 rounded-md border px-1 text-xs" :aria-label="t.rewriteField">
            <option :value="undefined">{{ t.fields.dialogues }}</option>
            <option value="beats">{{ t.fields.beats }}</option>
          </select>
          <button v-for="m in REWRITE_MODES.filter(x => x !== 'refine')" :key="m" class="hover:bg-muted rounded border px-1.5 py-0.5 disabled:opacity-50" :disabled="rewriting" @click="ask(s, m)">{{ t.modes[m] }}</button>
          <span v-if="rewriting" class="text-muted-foreground">{{ t.rewriting }}</span>
        </div>
      </CardContent>
    </Card>
    <div class="flex flex-col gap-1.5">
      <Label for="sv-punch">{{ t.punchline }}</Label>
      <Input id="sv-punch" v-model="draft.punchline" :disabled="!edit" />
      <AppSuggest v-if="edit" ai :label="t.punchline" :items="suggestions.punchline ?? []" :loading="suggesting === 'punchline'" :disabled="!!suggesting" @ask="want('punchline', 'punchline', draft.punchline)" @pick="v => pick('punchline', v)" />
    </div>
  </div>
</template>
