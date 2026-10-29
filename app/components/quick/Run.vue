<script setup lang="ts">
import type { Cut } from '#shared/studio'
import { Check, Loader2, RefreshCw } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { ko } from '~/locales/ko'

// QCK-21~25 진행 · QCK-30~34 완성
const props = defineProps<{ episodeId: string }>()
const t = ko.quick.run
const q = useQuick(toRef(props, 'episodeId'))
const { s } = q
const ep = s.episode
const ORDER = ['story', 'storyboard', 'images', 'bubbles'] as const
const at = computed(() => (q.stage.value === 'done' ? ORDER.length : ORDER.indexOf(q.stage.value as typeof ORDER[number])))
const percent = computed(() => {
  if (q.stage.value === 'done') return 100
  const n = s.cuts.value.length
  const img = q.stage.value === 'images' && n ? q.drawn.value / n : 0
  return Math.round(((at.value + img) / ORDER.length) * 100)
})
const pages = computed(() => {
  const m = new Map<string, Cut[]>()
  for (const c of s.cuts.value) m.set(c.page.id, [...(m.get(c.page.id) ?? []), c])
  return [...m.values()]
})
const aspect = computed(() => ep.value?.settings.aspect)
const openCut = ref<string | null>(null)
const studioLink = computed(() => ({ path: '/studio', query: { episode: props.episodeId, ...(q.stage.value === 'done' ? { step: 'export' } : {}) } }))
async function cancelAll() {
  await q.cancelAll()
  toast.success(t.canceled)
}
const cutNo = (c: Cut) => s.cuts.value.indexOf(c) + 1
</script>

<template>
  <div class="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4 pb-0">
    <div class="flex flex-col gap-1">
      <h1 class="text-xl font-bold">{{ q.stage.value === 'done' ? t.done : t.making }}</h1>
      <p class="text-muted-foreground text-sm">{{ s.seriesName.value }} · {{ ep?.title }}</p>
    </div>

    <template v-if="q.stage.value !== 'done'">
      <div class="bg-muted h-2 overflow-hidden rounded-full"><div class="bg-primary h-full transition-all" :style="{ width: `${percent}%` }" /></div>
      <ol class="flex flex-col gap-1.5 text-sm">
        <li v-for="(st, i) in ORDER" :key="st" class="flex items-center gap-2" :class="i < at ? 'text-muted-foreground' : i === at ? 'text-primary font-semibold' : 'text-muted-foreground/60'">
          <Check v-if="i < at" class="size-4" />
          <Loader2 v-else-if="i === at && !q.failed.value.length && !q.paused.value" class="size-4 animate-spin" />
          <span v-else class="size-4 text-center">·</span>
          {{ t.stages[st] }}<span v-if="st === 'images' && i === at"> · {{ t.drawing(q.drawn.value, s.cuts.value.length) }}</span>
        </li>
      </ol>
      <div v-if="q.failed.value.length || q.error.value" class="bg-destructive/10 flex flex-col gap-2 rounded-lg p-3 text-sm">
        <span>{{ q.error.value || t.failed }}</span>
        <Button size="sm" class="self-start" @click="q.resume"><RefreshCw class="size-4" />{{ t.retry }}</Button>
      </div>
      <p class="text-muted-foreground text-xs">{{ t.closeOk }}</p>
      <div v-if="pages.length" class="grid grid-cols-2 gap-2">
        <PageRender v-for="(cuts, i) in pages" :key="i" :cuts="cuts" :aspect="aspect" :typeset="q.review.typeset.value" class="w-full rounded border" />
      </div>
    </template>

    <template v-else>
      <p class="text-muted-foreground text-sm">{{ t.doneSub }}</p>
      <div v-for="(cuts, i) in pages" :key="i" class="flex flex-col gap-2">
        <PageRender :cuts="cuts" :aspect="aspect" :typeset="q.review.typeset.value" class="w-full rounded border" />
        <div class="flex flex-wrap gap-1.5">
          <Button v-for="c in cuts" :key="c.panel.id" size="sm" :variant="openCut === c.panel.id ? 'default' : 'outline'" @click="openCut = openCut === c.panel.id ? null : c.panel.id">
            <Loader2 v-if="q.redrawing.value.has(c.panel.id)" class="size-3.5 animate-spin" />{{ t.cut(cutNo(c)) }}
          </Button>
        </div>
        <template v-for="c in cuts" :key="`e-${c.panel.id}`">
          <div v-if="openCut === c.panel.id" class="bg-card flex flex-col gap-2 rounded-lg border p-3">
            <Input
              v-for="d in c.panel.dialogues"
              :key="d.id"
              :model-value="d.text"
              :aria-label="d.speaker || t.cut(cutNo(c))"
              maxlength="200"
              @change="(e: Event) => q.review.setText(c.panel.id, d.id, (e.target as HTMLInputElement).value)"
            />
            <Button size="sm" variant="outline" class="self-start" :disabled="q.redrawing.value.has(c.panel.id)" @click="q.redraw(c)">
              <RefreshCw class="size-4" />{{ q.redrawing.value.has(c.panel.id) ? t.redrawing : t.redraw }}
            </Button>
          </div>
        </template>
      </div>
    </template>

    <div class="bg-background sticky bottom-0 z-20 -mx-4 mt-auto border-t p-3">
      <div class="flex gap-2">
        <template v-if="q.stage.value !== 'done'">
          <Button variant="outline" class="h-11 flex-1" @click="cancelAll">{{ t.cancelAll }}</Button>
          <Button variant="outline" class="h-11 flex-1" as-child><NuxtLink :to="studioLink">{{ t.openStudio }}</NuxtLink></Button>
        </template>
        <template v-else>
          <Button variant="outline" class="h-11 flex-1" as-child><NuxtLink :to="{ path: '/quick', query: { again: '1' } }">{{ t.sameAgain }}</NuxtLink></Button>
          <Button class="h-11 flex-1" as-child><NuxtLink :to="studioLink">{{ q.answers.value?.video ? t.exportVideo : t.export }}</NuxtLink></Button>
        </template>
      </div>
    </div>
  </div>
</template>
