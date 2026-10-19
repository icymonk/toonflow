<script setup lang="ts">
import type { RewriteMode, StoryScene, StoryVersion } from '#shared/story'
import { useDebounceFn } from '@vueuse/core'
import { dialoguesToText, REWRITE_MODES, textToDialogues } from '#shared/story'
import { ko } from '~/locales/ko'

// STO-20·22: 가운데 각색안 본문 바로 고치기 (자동 저장)
const props = defineProps<{ version: StoryVersion, active: boolean, edit: boolean, versions: StoryVersion[], rev: number, rewriting: boolean }>()
const emit = defineEmits<{ save: [patch: Partial<Pick<StoryVersion, 'logline' | 'scenes' | 'punchline'>>], activate: [], remake: [], rewrite: [sceneId: string, field: 'beats' | 'dialogues', text: string, mode: RewriteMode, tone: string], compare: [id: string] }>()
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
function ask(s: (typeof draft.scenes)[number], mode: RewriteMode) {
  const f = field[s.id] ?? 'dialogues'
  const text = f === 'beats' ? s.beats : s.lines
  if (!text.trim()) return
  const tone = mode === 'tone' ? window.prompt(t.tonePrompt)?.trim() : ''
  if (tone === undefined || (mode === 'tone' && !tone)) return
  emit('rewrite', s.id, f, text, mode, tone)
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
    </div>
    <Card v-for="(s, i) in draft.scenes" :key="s.id" class="gap-2 py-3">
      <CardContent class="flex flex-col gap-2 px-4">
        <div class="flex items-center gap-2">
          <span class="text-muted-foreground w-14 shrink-0 text-xs">{{ t.scene(i + 1) }}</span>
          <Input v-model="s.heading" :disabled="!edit" :aria-label="t.heading" class="font-medium" />
        </div>
        <Textarea v-model="s.beats" :disabled="!edit" rows="2" :aria-label="t.beats" />
        <Textarea v-model="s.lines" :disabled="!edit" rows="3" :aria-label="t.dialogues" :placeholder="t.dialogues" class="font-mono text-xs" />
        <div v-if="edit" class="flex flex-wrap items-center gap-1 text-xs">
          <span class="text-muted-foreground">{{ t.rewrite }}</span>
          <select v-model="field[s.id]" class="border-input bg-card h-7 rounded-md border px-1 text-xs" :aria-label="t.rewriteField">
            <option :value="undefined">{{ t.fields.dialogues }}</option>
            <option value="beats">{{ t.fields.beats }}</option>
          </select>
          <button v-for="m in REWRITE_MODES" :key="m" class="hover:bg-muted rounded border px-1.5 py-0.5 disabled:opacity-50" :disabled="rewriting" @click="ask(s, m)">{{ t.modes[m] }}</button>
          <span v-if="rewriting" class="text-muted-foreground">{{ t.rewriting }}</span>
        </div>
      </CardContent>
    </Card>
    <div class="flex flex-col gap-1.5">
      <Label for="sv-punch">{{ t.punchline }}</Label>
      <Input id="sv-punch" v-model="draft.punchline" :disabled="!edit" />
    </div>
  </div>
</template>
