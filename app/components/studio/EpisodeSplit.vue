<script setup lang="ts">
import type { Episode } from '#shared/episodes'
import { Loader2, Scissors } from '@lucide/vue'
import { EPISODE_PARTS_MAX } from '#shared/episodes'
import { ko } from '~/locales/ko'

// STO-16 긴 썰을 여러 화로 나누기: AI 제안 → 고쳐서 확정
const props = defineProps<{ episode: Episode, edit: boolean, running: boolean, cost: number, hasMaterial: boolean }>()
const emit = defineEmits<{ plan: [count?: number], split: [parts: { title: string, text: string }[]] }>()
const t = ko.studio.split
const count = ref(0)
const parts = ref<{ title: string, text: string, hook: string }[]>([])
watch(() => props.episode.episodePlan?.jobId, () => (parts.value = (props.episode.episodePlan?.parts ?? []).map(p => ({ ...p }))), { immediate: true })
const sel = 'border-input bg-card h-8 rounded-lg border px-2 text-sm disabled:opacity-50'
async function confirm() {
  const list = parts.value.filter(p => p.text.trim()).map(p => ({ title: p.title.trim().slice(0, 80), text: p.text.trim() }))
  if (list.length < 2) return
  if (await confirmDialog(t.confirm(list.length))) emit('split', list)
}
</script>

<template>
  <section class="flex flex-col gap-2 border-t pt-3">
    <h3 class="flex items-center gap-2 text-sm font-semibold">
      {{ t.title }}
      <span v-if="episode.materialPart" class="bg-primary/10 text-primary rounded px-1.5 text-xs font-medium">{{ t.partOf(episode.materialPart.total, episode.materialPart.index) }}</span>
    </h3>
    <p class="text-muted-foreground text-xs">{{ episode.materialPart ? t.doneHint : t.hint }}</p>
    <div v-if="edit && !episode.materialPart" class="flex gap-1.5">
      <AppSelect v-model.number="count" :class="sel" :aria-label="t.count">
        <option :value="0">{{ t.auto }}</option>
        <option v-for="n in EPISODE_PARTS_MAX - 1" :key="n" :value="n + 1">{{ t.n(n + 1) }}</option>
      </AppSelect>
      <Button variant="outline" class="flex-1" :disabled="running || !hasMaterial" @click="emit('plan', count || undefined)">
        <Loader2 v-if="running" class="size-4 animate-spin" /><Scissors v-else class="size-4" /> {{ running ? t.planning : t.plan(cost) }}
      </Button>
    </div>
    <template v-if="parts.length && !episode.materialPart">
      <div v-for="(p, i) in parts" :key="i" class="flex flex-col gap-1 rounded-md border p-2">
        <span class="text-xs font-medium">{{ t.n(i + 1) }}</span>
        <Input v-model="p.title" class="h-8 text-xs" :placeholder="t.partTitle" :aria-label="t.partTitle" :disabled="!edit" />
        <Textarea v-model="p.text" rows="4" class="text-xs" :aria-label="t.partText" :disabled="!edit" />
        <p v-if="p.hook" class="text-muted-foreground text-xs">{{ t.hook }} {{ p.hook }}</p>
      </div>
      <Button v-if="edit" @click="confirm">{{ t.apply(parts.length) }}</Button>
    </template>
  </section>
</template>
