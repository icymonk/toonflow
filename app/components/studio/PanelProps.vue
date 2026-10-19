<script setup lang="ts">
import type { Dialogue, DialogueType, Page, PageLayout, Panel } from '#shared/studio'
import { ArrowDown, ArrowUp, Plus, X } from '@lucide/vue'
import { DIALOGUE_WARN_CHARS, layoutOptions, SHOTS } from '#shared/studio'
import { ko } from '~/locales/ko'

// SBD-10·11·13·23: 선택한 컷의 항목·대사·메모, 선택한 장의 배치
const props = defineProps<{ panel: Panel, page: Page, edit: boolean }>()
const emit = defineEmits<{ edit: [field: keyof Panel, value: unknown], layout: [layout: PageLayout] }>()
const t = ko.studio.board
const TYPES = Object.keys(t.lineTypes) as DialogueType[]
const selectClass = 'border-input bg-card h-9 rounded-md border px-2 text-sm disabled:opacity-50'

const lines = ref<Dialogue[]>([])
watch(() => props.panel.id, () => (lines.value = props.panel.dialogues.map(d => ({ ...d, speaker: d.speaker ?? '' }))), { immediate: true })
const saveLines = () => emit('edit', 'dialogues', lines.value.map(d => ({ ...d })))
function addLine() {
  lines.value.push({ id: `d${Date.now().toString(36)}`, type: 'speech', speaker: lines.value.at(-1)?.speaker ?? '', speakerId: null, text: '' })
  saveLines()
}
function moveLine(i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= lines.value.length) return
  ;[lines.value[i], lines.value[j]] = [lines.value[j]!, lines.value[i]!]
  saveLines()
}
function removeLine(i: number) {
  lines.value.splice(i, 1)
  saveLines()
}
const text = (field: keyof Panel) => String(props.panel[field] ?? '')
</script>

<template>
  <div v-if="page.panelIds.length === 2" class="flex flex-col gap-1.5">
    <Label>{{ t.layout }}</Label>
    <select :value="page.layout" :class="selectClass" :disabled="!edit" @change="emit('layout', ($event.target as HTMLSelectElement).value as PageLayout)">
      <option v-for="l in layoutOptions(2)" :key="l" :value="l">
        {{ t.layouts[l] }}
      </option>
    </select>
  </div>
  <div class="flex flex-col gap-1.5">
    <Label for="p-scene">{{ ko.studio.scene }}</Label>
    <Textarea id="p-scene" :model-value="panel.scene" :disabled="!edit" rows="4" maxlength="2000" @update:model-value="emit('edit', 'scene', String($event))" />
  </div>
  <div class="grid grid-cols-2 gap-2">
    <div class="col-span-2 flex flex-col gap-1">
      <Label for="p-place" class="text-xs">{{ t.place }}</Label>
      <Input id="p-place" :model-value="text('place')" :disabled="!edit" maxlength="200" @update:model-value="emit('edit', 'place', String($event))" />
    </div>
    <div class="col-span-2 flex flex-col gap-1">
      <Label for="p-chars" class="text-xs">{{ t.characters }}</Label>
      <Input
        id="p-chars" :model-value="(panel.characterNames ?? []).join(', ')" :disabled="!edit"
        @change="emit('edit', 'characterNames', ($event.target as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8))"
      />
    </div>
    <div class="flex flex-col gap-1">
      <Label class="text-xs">{{ t.shot }}</Label>
      <select :value="panel.shot" :class="selectClass" :disabled="!edit" @change="emit('edit', 'shot', ($event.target as HTMLSelectElement).value)">
        <option v-for="sh in ['', ...SHOTS]" :key="sh" :value="sh">
          {{ t.shots[sh as keyof typeof t.shots] }}
        </option>
      </select>
    </div>
    <div v-for="f in (['expression', 'action', 'outfit', 'mood'] as const)" :key="f" class="flex flex-col gap-1">
      <Label :for="`p-${f}`" class="text-xs">{{ t[f] }}</Label>
      <Input :id="`p-${f}`" :model-value="text(f)" :disabled="!edit" maxlength="200" @update:model-value="emit('edit', f, String($event))" />
    </div>
  </div>

  <div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between">
      <Label>{{ t.dialogues }}</Label>
      <Button v-if="edit" size="sm" variant="ghost" @click="addLine">
        <Plus class="size-3.5" /> {{ t.addLine }}
      </Button>
    </div>
    <div v-for="(d, i) in lines" :key="d.id" class="flex flex-col gap-1 rounded-md border p-1.5">
      <div class="flex gap-1">
        <select v-model="d.type" :class="[selectClass, 'h-8 w-24']" :disabled="!edit" :aria-label="t.line" @change="saveLines">
          <option v-for="ty in TYPES" :key="ty" :value="ty">
            {{ t.lineTypes[ty] }}
          </option>
        </select>
        <Input v-model="d.speaker" class="h-8 flex-1" :disabled="!edit || d.type === 'narration' || d.type === 'sfx'" :placeholder="t.speaker" :aria-label="t.speaker" @input="saveLines" />
        <template v-if="edit">
          <button :aria-label="ko.studio.moveUp" :disabled="i === 0" @click="moveLine(i, -1)"><ArrowUp class="size-3.5" /></button>
          <button :aria-label="ko.studio.moveDown" :disabled="i === lines.length - 1" @click="moveLine(i, 1)"><ArrowDown class="size-3.5" /></button>
          <button :aria-label="t.removeLine" @click="removeLine(i)"><X class="size-3.5" /></button>
        </template>
      </div>
      <Textarea v-model="d.text" rows="2" :disabled="!edit" :placeholder="t.line" :aria-label="t.line" maxlength="300" @input="saveLines" />
      <p v-if="d.text.length > DIALOGUE_WARN_CHARS" class="text-xs text-amber-700">
        {{ t.tooLong(DIALOGUE_WARN_CHARS) }}
      </p>
    </div>
  </div>

  <div class="flex flex-col gap-1.5">
    <Label for="p-note">{{ ko.studio.note }}</Label>
    <Textarea id="p-note" :model-value="panel.note" :disabled="!edit" rows="3" maxlength="2000" @update:model-value="emit('edit', 'note', String($event))" />
  </div>
</template>
