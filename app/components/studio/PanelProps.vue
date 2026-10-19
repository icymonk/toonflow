<script setup lang="ts">
import type { Character } from '#shared/library'
import type { Dialogue, DialogueType, Page, PageLayout, Panel } from '#shared/studio'
import { ArrowDown, ArrowUp, Check, Plus, X } from '@lucide/vue'
import { matchCharacters } from '#shared/library'
import { DIALOGUE_WARN_CHARS, layoutOptions, SHOTS } from '#shared/studio'
import { ko } from '~/locales/ko'

// SBD-10·11·13·23: 선택한 컷의 항목·대사·메모, 선택한 장의 배치
const props = defineProps<{ panel: Panel, page: Page, edit: boolean, characters?: Character[], refining?: boolean, styles?: { id: string, name: string }[] }>()
const emit = defineEmits<{ edit: [field: keyof Panel, value: unknown], layout: [layout: PageLayout], create: [name: string, once: boolean], refine: [], split: [], merge: [], refUpload: [file: File], refRemove: [] }>()
const hasNext = computed(() => props.page.panelIds.indexOf(props.panel.id) < props.page.panelIds.length - 1)
function pickRef(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) emit('refUpload', f);
  (e.target as HTMLInputElement).value = ''
}
// SBD-12·CHR-10: 이름별 연결 상태
const linked = (name: string) => matchCharacters([name], props.characters ?? []).length > 0
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
    <div v-if="edit" class="flex flex-wrap gap-1">
      <Button size="sm" variant="outline" :disabled="panel.dialogues.length < 2" @click="emit('split')">{{ ko.studio.board.split }}</Button>
      <Button size="sm" variant="outline" :disabled="!hasNext" @click="emit('merge')">{{ ko.studio.board.merge }}</Button>
    </div>
    <label v-if="styles?.length" class="flex items-center gap-2 text-xs">{{ ko.studio.illustrate.panelStyle }}
      <select :value="panel.styleId ?? ''" class="border-input bg-card h-8 rounded-md border px-2 text-xs" :disabled="!edit" @change="emit('edit', 'styleId', ($event.target as HTMLSelectElement).value || null)">
        <option value="">{{ ko.studio.illustrate.seriesStyle }}</option>
        <option v-for="st in styles" :key="st.id" :value="st.id">{{ st.name }}</option>
      </select>
    </label>
    <Label for="p-scene">{{ ko.studio.scene }}</Label>
    <Textarea id="p-scene" :model-value="panel.scene" :disabled="!edit" rows="4" maxlength="2000" @update:model-value="emit('edit', 'scene', String($event))" />
    <Button v-if="edit" size="sm" variant="outline" class="self-start" :disabled="refining || !panel.scene.trim()" @click="emit('refine')">{{ refining ? ko.studio.board.refining : ko.studio.board.refine }}</Button>
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <span class="text-muted-foreground">{{ ko.studio.board.refImage }}</span>
      <span v-if="panel.refImage" class="max-w-40 truncate">{{ panel.refImage.split('/').pop() }}</span>
      <label v-if="edit" class="hover:bg-muted cursor-pointer rounded border px-1.5 py-0.5">{{ ko.studio.board.refUpload }}<input type="file" accept="image/*" class="hidden" @change="pickRef"></label>
      <button v-if="edit && panel.refImage" class="text-muted-foreground hover:underline" @click="emit('refRemove')">{{ ko.studio.board.refRemove }}</button>
    </div>
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
      <div v-if="panel.characterNames?.length" class="flex flex-wrap gap-1">
        <span v-for="n in panel.characterNames" :key="n" class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
          <template v-if="linked(n)"><Check class="size-3 text-emerald-700" :aria-label="ko.library.linked" />{{ n }}</template>
          <template v-else>
            {{ n }}
            <template v-if="edit">
              <button class="underline" @click="emit('create', n, false)">{{ ko.library.makeCharacter }}</button>
              <button class="text-muted-foreground underline" @click="emit('create', n, true)">{{ ko.library.makeOnce }}</button>
            </template>
          </template>
        </span>
      </div>
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
