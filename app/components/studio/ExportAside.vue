<script setup lang="ts">
import { Copy, Download, Loader2, Sparkles } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { PAGE_SIZES, POST_LIMIT } from '#shared/render'
import { ko } from '~/locales/ko'

// PUB-01·03·04·05·06·10·11·12·13·14·20, CMN-43
interface SeriesPub { hashtags: string, greeting: string, watermark: string }
const props = defineProps<{
  pageCount: number, currentPage: number, aspect: string, format: 'jpg' | 'png', aiLabel: boolean, progress: string | null, edit: boolean
  caption: string, captionText: string, hashtags: string[], series: SeriesPub, published: { at: string, url: string } | null, captionCost: number, captioning: boolean
  credit: string, creditPlace: 'caption' | 'page', withdrawn: number, hiRes: boolean, plannedAt: string
}>()
const emit = defineEmits<{ settings: [patch: Record<string, unknown>], all: [], one: [], makeCaption: [], captionText: [text: string], series: [patch: Partial<SeriesPub>], publish: [url: string], unpublish: [] }>()
const t = ko.studio.publish
const sel = 'border-input bg-card h-8 rounded-md border px-2 text-sm'
const url = ref('')
const val = (e: Event) => (e.target as HTMLInputElement | HTMLTextAreaElement).value
async function toggleLabel(e: Event) {
  (e.target as HTMLInputElement).checked = props.aiLabel
  if (props.aiLabel && !await confirmDialog(t.aiLabelOff)) return
  emit('settings', { aiLabel: !props.aiLabel })
}
async function copy() {
  await navigator.clipboard.writeText(props.caption)
  toast.success(t.copied)
}
</script>

<template>
  <div class="flex flex-col gap-3 text-sm">
    <label class="flex items-center gap-2 text-xs">{{ t.aspect }}
      <select :value="aspect" :class="sel" :disabled="!edit" @change="emit('settings', { aspect: val($event) })">
        <option v-for="(v, k) in PAGE_SIZES" :key="k" :value="k">{{ k }} ({{ v.w }}×{{ v.h }})</option>
      </select>
    </label>
    <p class="text-muted-foreground text-xs">{{ t.aspectNote }}</p>
    <label class="flex items-center gap-2 text-xs">{{ t.format }}
      <select :value="format" :class="sel" :disabled="!edit" @change="emit('settings', { format: val($event) })">
        <option value="jpg">{{ t.jpg }}</option>
        <option value="png">PNG</option>
      </select>
    </label>
    <label class="flex items-center gap-2 text-xs"><input type="checkbox" :checked="hiRes" :disabled="!edit" @change="emit('settings', { hiRes: !hiRes })">{{ t.hiRes }}</label>
    <div v-if="withdrawn" class="rounded-md bg-red-100 px-2 py-1.5 text-xs text-red-900" role="alert">{{ t.withdrawnAlert(withdrawn) }}</div>
    <div v-if="pageCount > POST_LIMIT" class="rounded-md bg-amber-100 px-2 py-1.5 text-xs text-amber-900" role="alert">{{ t.overLimit(pageCount, POST_LIMIT) }}</div>
    <Button :disabled="!!progress || !pageCount" @click="emit('all')"><Download class="size-4" /> {{ t.all(pageCount) }}</Button>
    <Button variant="outline" :disabled="!!progress || !pageCount" @click="emit('one')">{{ t.one(currentPage + 1) }}</Button>
    <p v-if="progress" class="text-muted-foreground flex items-center gap-1.5 text-xs"><Loader2 class="size-3.5 animate-spin" />{{ progress }}</p>

    <section class="flex flex-col gap-1.5 border-t pt-3">
      <span class="font-medium">{{ t.captionTitle }}</span>
      <Button size="sm" variant="outline" :disabled="!edit || captioning" @click="emit('makeCaption')">
        <Loader2 v-if="captioning" class="size-3.5 animate-spin" /><Sparkles v-else class="size-3.5" /> {{ captioning ? t.captioning : t.makeCaption(captionCost) }}
      </Button>
      <Textarea :model-value="captionText" rows="4" class="text-xs" :placeholder="t.captionPh" :disabled="!edit" @change="emit('captionText', val($event))" />
      <p v-if="hashtags.length" class="text-primary text-xs">{{ hashtags.join(' ') }}</p>
      <label class="flex items-center gap-2 text-xs"><input type="checkbox" :checked="aiLabel" :disabled="!edit" @change.prevent="toggleLabel">{{ t.aiLabel }}</label>
      <label v-if="credit" class="flex items-center gap-2 text-xs">{{ t.creditPlace }}
        <select :value="creditPlace" :class="sel" :disabled="!edit" :aria-label="t.creditPlace" @change="emit('settings', { creditPlace: val($event) })">
          <option value="caption">{{ t.creditCaption }}</option>
          <option value="page">{{ t.creditPage }}</option>
        </select>
      </label>
      <p v-if="credit" class="text-muted-foreground text-xs">{{ credit }}</p>
      <p class="text-muted-foreground text-xs">{{ t.caption }}</p>
      <div class="bg-muted flex items-start gap-2 rounded p-2 text-xs">
        <span class="flex-1 whitespace-pre-wrap">{{ caption }}</span>
        <button :aria-label="t.copy" :title="t.copy" @click="copy"><Copy class="size-3.5" /></button>
      </div>
      <p class="text-muted-foreground text-xs">{{ t.notice }}</p>
    </section>

    <section class="flex flex-col gap-1.5 border-t pt-3">
      <span class="font-medium">{{ t.seriesSettings }}</span>
      <Label for="pub-wm" class="text-xs">{{ t.watermark }}</Label>
      <Input id="pub-wm" :model-value="series.watermark" class="h-8 text-xs" placeholder="@my_toon" :disabled="!edit" @change="emit('series', { watermark: val($event).slice(0, 40) })" />
      <Label for="pub-greet" class="text-xs">{{ t.greeting }}</Label>
      <Input id="pub-greet" :model-value="series.greeting" class="h-8 text-xs" :disabled="!edit" @change="emit('series', { greeting: val($event).slice(0, 200) })" />
      <Label for="pub-tags" class="text-xs">{{ t.fixedTags }}</Label>
      <Input id="pub-tags" :model-value="series.hashtags" class="h-8 text-xs" placeholder="#인스타툰 #공감툰" :disabled="!edit" @change="emit('series', { hashtags: val($event).slice(0, 300) })" />
    </section>

    <section class="flex flex-col gap-1.5 border-t pt-3">
      <span class="font-medium">{{ t.publishTitle }}</span>
      <template v-if="published">
        <p class="text-xs text-emerald-700">{{ t.publishedOn(published.at) }}</p>
        <a v-if="published.url" :href="published.url" target="_blank" rel="noopener" class="text-primary break-all text-xs underline">{{ published.url }}</a>
        <Button size="sm" variant="ghost" class="self-start" :disabled="!edit" @click="emit('unpublish')">{{ t.unpublish }}</Button>
      </template>
      <form v-else class="flex flex-col gap-1.5" @submit.prevent="emit('publish', url.trim())">
        <label class="flex items-center gap-2 text-xs">{{ t.plannedAt }}<input type="date" class="border-input bg-card h-8 rounded-md border px-2 text-xs" :value="plannedAt" :disabled="!edit" @change="emit('settings', { plannedAt: val($event) || null })"></label>
        <p class="text-muted-foreground text-xs">{{ t.plannedNote }}</p>
        <Input v-model="url" type="url" class="h-8 text-xs" :placeholder="t.urlPh" :disabled="!edit" />
        <Button size="sm" type="submit" :disabled="!edit">{{ t.markPublished }}</Button>
      </form>
    </section>
  </div>
</template>
