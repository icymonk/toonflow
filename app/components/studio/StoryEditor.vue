<script setup lang="ts">
import type { StoryScene, StoryVersion } from '#shared/story'
import { useDebounceFn } from '@vueuse/core'
import { dialoguesToText, textToDialogues } from '#shared/story'
import { ko } from '~/locales/ko'

// STO-20·22: 가운데 각색안 본문 바로 고치기 (자동 저장)
const props = defineProps<{ version: StoryVersion, active: boolean, edit: boolean }>()
const emit = defineEmits<{ save: [patch: Partial<Pick<StoryVersion, 'logline' | 'scenes' | 'punchline'>>], activate: [], remake: [] }>()
const t = ko.studio.story

const draft = reactive({ logline: '', punchline: '', scenes: [] as (Omit<StoryScene, 'dialogues'> & { lines: string })[] })
function load(v: StoryVersion) {
  draft.logline = v.logline
  draft.punchline = v.punchline
  draft.scenes = v.scenes.map(s => ({ id: s.id, heading: s.heading, beats: s.beats, lines: dialoguesToText(s.dialogues) }))
}
watch(() => props.version.id, () => load(props.version), { immediate: true })
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
      <div v-if="edit" class="ml-auto flex gap-2">
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
      </CardContent>
    </Card>
    <div class="flex flex-col gap-1.5">
      <Label for="sv-punch">{{ t.punchline }}</Label>
      <Input id="sv-punch" v-model="draft.punchline" :disabled="!edit" />
    </div>
  </div>
</template>
