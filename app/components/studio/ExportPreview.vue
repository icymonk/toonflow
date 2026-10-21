<script setup lang="ts">
import type { DesignInfo } from '#shared/pagedesign'
import type { Typeset } from '#shared/render'
import type { ExportSlot } from '~/composables/useExport'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { ko } from '~/locales/ko'

// PUB-02: 인스타그램처럼 넘겨 보기 + 프로필 격자 썸네일
const props = defineProps<{ watermark?: string | null, pages: ExportSlot[], info: DesignInfo, aspect: string, typeset: Typeset, label: string | null, name: string }>()
const page = defineModel<number>({ default: 0 })
const t = ko.studio.publish
const last = computed(() => props.pages.length - 1)
const cur = computed(() => props.pages[page.value])
const first = computed(() => props.pages[0])
const go = (d: number) => (page.value = Math.min(last.value, Math.max(0, page.value + d)))
</script>

<template>
  <div class="flex w-full flex-1 items-start justify-center gap-8 overflow-y-auto">
    <div class="bg-card flex w-full max-w-sm flex-col rounded-lg border shadow-sm">
      <div class="flex items-center gap-2 px-3 py-2 text-sm font-semibold"><span class="bg-primary size-7 rounded-full" />{{ name }}</div>
      <div class="relative">
        <template v-if="cur">
          <PageRender v-if="cur.kind === 'cuts'" :cuts="cur.cuts" :aspect="aspect" :typeset="typeset" :label="page === last ? label : null" :watermark="watermark" class="w-full" />
          <PageRenderDesignRender v-else :design="cur.design" :info="info" :aspect="aspect" :typeset="typeset" :label="page === last ? label : null" :watermark="watermark" class="w-full" />
        </template>
        <button v-if="page > 0" class="bg-card/80 absolute top-1/2 left-2 rounded-full p-1" :aria-label="ko.studio.prev" @click="go(-1)"><ChevronLeft class="size-4" /></button>
        <button v-if="page < last" class="bg-card/80 absolute top-1/2 right-2 rounded-full p-1" :aria-label="ko.studio.next" @click="go(1)"><ChevronRight class="size-4" /></button>
      </div>
      <div class="flex justify-center gap-1 py-2">
        <span v-for="(_, i) in pages" :key="i" class="size-1.5 rounded-full" :class="i === page ? 'bg-primary' : 'bg-muted-foreground/30'" />
      </div>
    </div>
    <div class="flex w-48 flex-col gap-1.5">
      <span class="text-muted-foreground text-xs">{{ t.grid }}</span>
      <div class="grid grid-cols-3 gap-0.5">
        <div v-if="first" class="relative aspect-[3/4] overflow-hidden">
          <PageRender v-if="first.kind === 'cuts'" :cuts="first.cuts" :aspect="aspect" :typeset="typeset" class="absolute top-1/2 left-0 w-full -translate-y-1/2" />
          <PageRenderDesignRender v-else :design="first.design" :info="info" :aspect="aspect" :typeset="typeset" class="absolute top-1/2 left-0 w-full -translate-y-1/2" />
        </div>
        <div v-for="i in 5" :key="i" class="bg-muted aspect-[3/4]" />
      </div>
    </div>
  </div>
</template>
