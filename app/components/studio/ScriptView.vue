<script setup lang="ts">
import type { Cut, Dialogue, Panel } from '#shared/studio'
import { dialoguesToText, textToDialogues } from '#shared/story'
import { ko } from '~/locales/ko'

// SBD-31 대본 보기: 모든 컷의 장면·대사를 이어서 보고 고치기 (칸을 벗어나면 저장)
defineProps<{ cuts: Cut[], edit: boolean, selectedId: string }>()
const emit = defineEmits<{ edit: [panel: Panel, field: keyof Panel, value: unknown], select: [id: string] }>()
const toText = (ds: Dialogue[]) => dialoguesToText(ds.map(d => ({ type: d.type, speaker: d.speaker ?? '', text: d.text })))
const toLines = (text: string): Dialogue[] => textToDialogues(text).map((l, i) => ({ id: `d${i + 1}`, ...l, speakerId: null }))
</script>

<template>
  <div class="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 overflow-y-auto">
    <p class="text-muted-foreground text-xs">
      {{ ko.studio.board.scriptHint }}
    </p>
    <div v-for="c in cuts" :key="c.panel.id" class="flex flex-col gap-1.5 rounded-md border p-3" :class="{ 'ring-primary ring-1': c.panel.id === selectedId }" @focusin="emit('select', c.panel.id)">
      <span class="text-muted-foreground text-xs font-medium">{{ ko.studio.page(c.pageIndex + 1) }} · {{ ko.studio.cut(c.number) }}</span>
      <Textarea :model-value="c.panel.scene" rows="2" :disabled="!edit" :aria-label="ko.studio.scene" @change="emit('edit', c.panel, 'scene', ($event.target as HTMLTextAreaElement).value)" />
      <Textarea :model-value="toText(c.panel.dialogues)" rows="3" class="font-mono text-xs" :disabled="!edit" :aria-label="ko.studio.board.dialogues" @change="emit('edit', c.panel, 'dialogues', toLines(($event.target as HTMLTextAreaElement).value))" />
    </div>
  </div>
</template>
