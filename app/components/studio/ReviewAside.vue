<script setup lang="ts">
import type { AiCheck, AiCheckMode } from '#shared/aicheck'
import type { Bubble, BubbleStyle, BubbleTemplate, CheckIssue, Typeset } from '#shared/render'
import type { ChecklistRow, ReviewState } from '#shared/review'
import type { Cut, DialogueType } from '#shared/studio'
import { useDebounceFn } from '@vueuse/core'
import { AI_CHECK_MODES } from '#shared/aicheck'
import { BUBBLE_TAILS, bubbleStyle, FONTS } from '#shared/render'
import { REVIEW_STATES } from '#shared/review'
import { ko } from '~/locales/ko'

// REV-02·03·04·11
const props = defineProps<{ cut: Cut, bubbles: Bubble[], selected: string | null, typeset: Typeset, issues: CheckIssue[], edit: boolean, checklist: ChecklistRow[], left: number, aiCheck: AiCheck | null, aiItems: { panelId: string, issue: string, number: number }[], checkInfo: Record<AiCheckMode, { n: number, cost: number }>, checking: boolean, templates: BubbleTemplate[] }>()
const emit = defineEmits<{ text: [dialogueId: string, text: string], bubble: [dialogueId: string, patch: Partial<Bubble>], typeset: [patch: Partial<Typeset>], replace: [], pick: [issue: CheckIssue], check: [key: string, state: ReviewState], addItem: [label: string], removeItem: [label: string], aiCheck: [mode: AiCheckMode], pickPanel: [panelId: string], saveTemplate: [name: string, style: BubbleStyle] }>()
const t = ko.studio.review
const SHAPES = Object.keys(t.shapes) as DialogueType[]
const bubble = computed(() => props.bubbles.find(b => b.dialogueId === props.selected) ?? null)
const dialogue = computed(() => props.cut.panel.dialogues.find(d => d.id === props.selected) ?? null)
const draft = ref('')
watch(() => [props.selected, dialogue.value?.text] as const, () => (draft.value = dialogue.value?.text ?? ''), { immediate: true })
const saveText = useDebounceFn(() => dialogue.value && draft.value !== dialogue.value.text && emit('text', dialogue.value.id, draft.value), 500)
const sel = 'border-input bg-card h-8 rounded-md border px-2 text-sm'
// REV-07
async function saveTpl() {
  const n = (await promptDialog(t.tpl.namePrompt))?.trim()
  if (n && bubble.value) emit('saveTemplate', n, bubbleStyle(bubble.value))
}
function applyTpl(e: Event) {
  const el = e.target as HTMLSelectElement
  const tp = props.templates.find(x => x.id === el.value)
  if (tp && bubble.value) emit('bubble', bubble.value.dialogueId, bubbleStyle(tp))
  el.value = ''
}
const newItem = ref('')
function addItem() {
  const v = newItem.value.trim().slice(0, 40)
  if (v) emit('addItem', v)
  newItem.value = ''
}
const tone = (st: ReviewState) => (st === 'pass' ? 'text-emerald-700' : st === 'needs' ? 'text-amber-800' : '')
</script>

<template>
  <div class="flex flex-col gap-3 text-sm">
    <section class="flex flex-col gap-2">
      <span class="font-medium">{{ t.bubble }}</span>
      <p v-if="!cut.panel.dialogues.length" class="text-muted-foreground text-xs">{{ t.noDialogue }}</p>
      <p v-else-if="!bubble || !dialogue" class="text-muted-foreground text-xs">{{ t.pickBubble }}</p>
      <template v-else>
        <Label for="rev-text" class="text-xs">{{ t.text }}</Label>
        <Textarea id="rev-text" v-model="draft" rows="3" :disabled="!edit" @input="saveText" />
        <label class="flex items-center gap-2 text-xs">{{ t.shape }}
          <select :value="bubble.shape" :class="sel" :disabled="!edit" @change="emit('bubble', bubble.dialogueId, { shape: ($event.target as HTMLSelectElement).value as DialogueType })">
            <option v-for="s in SHAPES" :key="s" :value="s">{{ t.shapes[s] }}</option>
          </select>
        </label>
        <div class="flex items-center gap-3 text-xs">
          <label class="flex items-center gap-2">{{ t.fontSize }}
            <input :value="bubble.fontSize" type="number" min="12" max="96" :class="[sel, 'w-16']" :disabled="!edit" @change="emit('bubble', bubble.dialogueId, { fontSize: Number(($event.target as HTMLInputElement).value) })">
          </label>
          <label class="flex items-center gap-1"><input type="checkbox" :checked="bubble.bold" :disabled="!edit" @change="emit('bubble', bubble.dialogueId, { bold: !bubble.bold })">{{ t.bold }}</label>
        </div>
        <div class="flex items-center gap-1 text-xs">
          <span class="mr-1">{{ t.tail }}</span>
          <button
            v-for="tl in BUBBLE_TAILS" :key="tl" class="rounded border px-1.5 py-0.5" :class="{ 'bg-primary text-primary-foreground': bubble.tail === tl }"
            :disabled="!edit" @click="emit('bubble', bubble.dialogueId, { tail: tl })"
          >
            {{ t.tails[tl] }}
          </button>
        </div>
        <div v-if="edit" class="flex items-center gap-1 text-xs">
          <select :class="[sel, 'min-w-0 flex-1']" :aria-label="t.tpl.apply" @change="applyTpl">
            <option value="">{{ templates.length ? t.tpl.apply : t.tpl.none }}</option>
            <option v-for="tp in templates" :key="tp.id" :value="tp.id">{{ tp.name }} · {{ t.shapes[tp.shape] }}</option>
          </select>
          <Button size="sm" variant="ghost" @click="saveTpl">{{ t.tpl.save }}</Button>
        </div>
      </template>
      <Button v-if="edit && cut.panel.dialogues.length" size="sm" variant="outline" @click="emit('replace')">{{ t.replacePanel }}</Button>
    </section>

    <section class="flex flex-col gap-2 border-t pt-3">
      <span class="font-medium">{{ t.typeset }}</span>
      <label class="flex items-center gap-2 text-xs">{{ t.font }}
        <select :value="typeset.font" :class="sel" :disabled="!edit" @change="emit('typeset', { font: ($event.target as HTMLSelectElement).value as Typeset['font'] })">
          <option v-for="f in FONTS" :key="f.id" :value="f.id">{{ f.label }} ({{ f.license }})</option>
        </select>
      </label>
      <label class="flex items-center gap-2 text-xs">{{ t.baseSize }}
        <input :value="typeset.fontSize" type="number" min="12" max="96" :class="[sel, 'w-16']" :disabled="!edit" @change="emit('typeset', { fontSize: Number(($event.target as HTMLInputElement).value) })">
      </label>
      <label class="flex items-center gap-2 text-xs">{{ t.stroke }}
        <input :value="typeset.strokeWidth" type="number" min="0" max="10" :class="[sel, 'w-16']" :disabled="!edit" @change="emit('typeset', { strokeWidth: Number(($event.target as HTMLInputElement).value) })">
      </label>
    </section>

    <section class="flex flex-col gap-1.5 border-t pt-3">
      <span class="font-medium">{{ t.list }} <span class="text-muted-foreground text-xs font-normal">· {{ t.left(left) }}</span></span>
      <div v-for="r in checklist" :key="r.key" class="flex items-center gap-2 text-xs">
        <span class="flex-1" :class="tone(r.state)">{{ r.custom ?? t.items[r.key] }}<span v-if="r.auto" class="text-muted-foreground"> · {{ t.auto }}</span></span>
        <select :value="r.state" :class="[sel, 'h-7 text-xs']" :aria-label="r.custom ?? t.items[r.key]" :disabled="!edit || (r.auto && r.state === 'pass' && r.key !== 'privacy')" @change="emit('check', r.key, ($event.target as HTMLSelectElement).value as ReviewState)">
          <option v-for="st in REVIEW_STATES" :key="st" :value="st">{{ t.states[st] }}</option>
        </select>
        <button v-if="r.custom && edit" class="text-muted-foreground hover:text-destructive" :aria-label="t.removeItem" @click="emit('removeItem', r.custom)">×</button>
      </div>
      <form v-if="edit" class="flex gap-1" @submit.prevent="addItem">
        <Input v-model="newItem" class="h-8 text-xs" :placeholder="t.addItemPh" />
        <Button size="sm" variant="outline" type="submit">{{ t.addItem }}</Button>
      </form>
    </section>

    <section class="flex flex-col gap-1.5 border-t pt-3">
      <span class="font-medium">{{ t.checks }}</span>
      <p v-if="!issues.length" class="text-xs text-emerald-700">{{ t.noIssues }}</p>
      <button v-for="(is, i) in issues" :key="i" class="text-left text-xs text-amber-800 hover:underline" @click="emit('pick', is)">
        {{ t.issues[is.kind](is.number) }}
      </button>
    </section>

    <section class="flex flex-col gap-1.5 border-t pt-3">
      <span class="font-medium">{{ t.ai.title }}</span>
      <p class="text-muted-foreground text-xs">{{ t.ai.hint }}</p>
      <Button v-for="m in AI_CHECK_MODES" :key="m" size="sm" variant="outline" :disabled="!edit || checking || !checkInfo[m].n" @click="emit('aiCheck', m)">
        {{ t.ai.run(t.ai.modes[m], checkInfo[m].n, checkInfo[m].cost) }}
      </Button>
      <p v-if="checking" class="text-muted-foreground text-xs">{{ t.ai.running }}</p>
      <template v-else-if="aiCheck">
        <p class="text-muted-foreground text-xs">{{ t.ai.result(t.ai.modes[aiCheck.mode], aiCheck.count) }}</p>
        <p v-if="!aiItems.length" class="text-xs text-emerald-700">{{ t.noIssues }}</p>
        <button v-for="(it, i) in aiItems" :key="i" class="text-left text-xs text-amber-800 hover:underline" @click="emit('pickPanel', it.panelId)">
          {{ t.ai.item(it.number, it.issue) }}
        </button>
      </template>
    </section>
  </div>
</template>
