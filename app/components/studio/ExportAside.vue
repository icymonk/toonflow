<script setup lang="ts">
import { Copy, Download, Loader2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { AI_CAPTION, PAGE_SIZES, POST_LIMIT } from '#shared/render'
import { ko } from '~/locales/ko'

// PUB-01·03·04·05·13, CMN-43
const props = defineProps<{ pageCount: number, currentPage: number, aspect: string, format: 'jpg' | 'png', aiLabel: boolean, progress: string | null, edit: boolean }>()
const emit = defineEmits<{ settings: [patch: Record<string, unknown>], all: [], one: [] }>()
const t = ko.studio.publish
const sel = 'border-input bg-card h-8 rounded-md border px-2 text-sm'
function toggleLabel() {
  if (props.aiLabel && !window.confirm(t.aiLabelOff)) return
  emit('settings', { aiLabel: !props.aiLabel })
}
async function copy() {
  await navigator.clipboard.writeText(AI_CAPTION)
  toast.success(t.copied)
}
</script>

<template>
  <div class="flex flex-col gap-3 text-sm">
    <label class="flex items-center gap-2 text-xs">{{ t.aspect }}
      <select :value="aspect" :class="sel" :disabled="!edit" @change="emit('settings', { aspect: ($event.target as HTMLSelectElement).value })">
        <option v-for="(v, k) in PAGE_SIZES" :key="k" :value="k">{{ k }} ({{ v.w }}×{{ v.h }})</option>
      </select>
    </label>
    <p class="text-muted-foreground text-xs">{{ t.aspectNote }}</p>
    <label class="flex items-center gap-2 text-xs">{{ t.format }}
      <select :value="format" :class="sel" :disabled="!edit" @change="emit('settings', { format: ($event.target as HTMLSelectElement).value })">
        <option value="jpg">{{ t.jpg }}</option>
        <option value="png">PNG</option>
      </select>
    </label>
    <div v-if="pageCount > POST_LIMIT" class="rounded-md bg-amber-100 px-2 py-1.5 text-xs text-amber-900" role="alert">{{ t.overLimit(pageCount, POST_LIMIT) }}</div>
    <Button :disabled="!!progress || !pageCount" @click="emit('all')"><Download class="size-4" /> {{ t.all(pageCount) }}</Button>
    <Button variant="outline" :disabled="!!progress || !pageCount" @click="emit('one')">{{ t.one(currentPage + 1) }}</Button>
    <p v-if="progress" class="text-muted-foreground flex items-center gap-1.5 text-xs"><Loader2 class="size-3.5 animate-spin" />{{ progress }}</p>

    <section class="flex flex-col gap-1.5 border-t pt-3">
      <label class="flex items-center gap-2 text-xs"><input type="checkbox" :checked="aiLabel" :disabled="!edit" @change.prevent="toggleLabel">{{ t.aiLabel }}</label>
      <p class="text-muted-foreground text-xs">{{ t.caption }}</p>
      <div class="bg-muted flex items-start gap-2 rounded p-2 text-xs">
        <span class="flex-1">{{ AI_CAPTION }}</span>
        <button :aria-label="t.copy" :title="t.copy" @click="copy"><Copy class="size-3.5" /></button>
      </div>
      <p class="text-muted-foreground text-xs">{{ t.notice }}</p>
    </section>
  </div>
</template>
