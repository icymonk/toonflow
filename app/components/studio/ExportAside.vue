<script setup lang="ts">
import type { SocialPlatform } from '#shared/social'
import type { DesignKind, PageDesign } from '#shared/pagedesign'
import { DESIGN_FROM_SERIES, DESIGN_KINDS } from '#shared/pagedesign'
import { SOCIAL_NAMES } from '#shared/social'
import { Copy, Download, Loader2, Sparkles } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { PAGE_SIZES, POST_LIMIT } from '#shared/render'
import { ko } from '~/locales/ko'

// PUB-01·03·04·05·06·10·11·12·13·14·20, CMN-43
interface SeriesPub { hashtags: string, greeting: string, watermark: string }
const props = defineProps<{
  pageCount: number, currentPage: number, aspect: string, format: 'jpg' | 'png', aiLabel: boolean, progress: string | null, edit: boolean
  caption: string, captionText: string, hashtags: string[], series: SeriesPub, published: { at: string, url: string, manual: boolean } | null, captionCost: number, captioning: boolean
  credit: string, creditPlace: 'caption' | 'page', withdrawn: number, hiRes: boolean, plannedAt: string, instagram: string | null, igState: 'posting' | 'failed' | null
  threads: string | null, thState: 'posting' | 'failed' | null, posted: Partial<Record<SocialPlatform, { at: string, url: string }>>
  socialProgress: Partial<Record<SocialPlatform, { ratio: number, step: string }>>
  designs: PageDesign[], coverId?: string, outroId?: string, seriesCoverId: string | null, seriesOutroId: string | null
}>()
const emit = defineEmits<{ settings: [patch: Record<string, unknown>], all: [], one: [], makeCaption: [], captionText: [text: string], series: [patch: Partial<SeriesPub>], publish: [url: string], unpublish: [], social: [platforms: SocialPlatform[]], design: [kind: DesignKind, value: string], seriesDesign: [kind: DesignKind, id: string | null] }>()
const t = ko.studio.publish
const sel = 'border-input bg-card h-8 rounded-md border px-2 text-sm'
const url = ref('')
// PUB-15·16
const designsOf = (k: DesignKind) => props.designs.filter(d => d.kind === k && !d.archivedAt)
const designName = (id: string | null) => props.designs.find(d => d.id === id)?.name ?? ''
const episodeDesign = (k: DesignKind) => (k === 'cover' ? props.coverId : props.outroId) ?? DESIGN_FROM_SERIES
const seriesDesign = (k: DesignKind) => (k === 'cover' ? props.seriesCoverId : props.seriesOutroId)
const val = (e: Event) => (e.target as HTMLInputElement | HTMLTextAreaElement).value
async function toggleLabel() {
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
      <AppSelect :value="aspect" :class="sel" :disabled="!edit" @change="emit('settings', { aspect: $event })">
        <option v-for="(v, k) in PAGE_SIZES" :key="k" :value="k">{{ k }} ({{ v.w }}×{{ v.h }})</option>
      </AppSelect>
    </label>
    <p class="text-muted-foreground text-xs">{{ t.aspectNote }}</p>
    <label class="flex items-center gap-2 text-xs">{{ t.format }}
      <AppSelect :value="format" :class="sel" :disabled="!edit" @change="emit('settings', { format: $event })">
        <option value="jpg">{{ t.jpg }}</option>
        <option value="png">PNG</option>
      </AppSelect>
    </label>
    <label class="flex items-center gap-2 text-xs"><AppCheck :model-value="hiRes" :disabled="!edit" @change="emit('settings', { hiRes: !hiRes })" />{{ t.hiRes }}</label>
    <div v-if="withdrawn" class="rounded-md bg-red-100 px-2 py-1.5 text-xs text-red-900" role="alert">{{ t.withdrawnAlert(withdrawn) }}</div>
    <div v-if="pageCount > POST_LIMIT" class="rounded-md bg-amber-100 px-2 py-1.5 text-xs text-amber-900" role="alert">{{ t.overLimit(pageCount, POST_LIMIT) }}</div>
    <Button :disabled="!!progress || !pageCount" @click="emit('all')"><Download class="size-4" /> {{ t.all(pageCount) }}</Button>
    <Button variant="outline" :disabled="!!progress || !pageCount" @click="emit('one')">{{ t.one(currentPage + 1) }}</Button>
    <p v-if="progress" class="text-muted-foreground flex items-center gap-1.5 text-xs"><Loader2 class="size-3.5 animate-spin" />{{ progress }}</p>

    <section class="flex flex-col gap-1.5 border-t pt-3">
      <span class="font-medium">{{ t.designs }}</span>
      <label v-for="k in DESIGN_KINDS" :key="k" class="flex items-center gap-2 text-xs">{{ t.designKind[k] }}
        <AppSelect :value="episodeDesign(k)" :class="sel" :disabled="!edit" :aria-label="t.designKind[k]" @change="emit('design', k, $event)">
          <option :value="DESIGN_FROM_SERIES">{{ t.designSeries(designName(seriesDesign(k))) }}</option>
          <option value="">{{ t.designNone }}</option>
          <option v-for="d in designsOf(k)" :key="d.id" :value="d.id">{{ d.name }}</option>
        </AppSelect>
      </label>
      <p class="text-muted-foreground text-xs">{{ t.designNote }}</p>
      <NuxtLink to="/page-designs" class="text-primary self-start text-xs underline">{{ t.designManage }}</NuxtLink>
    </section>

    <section class="flex flex-col gap-1.5 border-t pt-3">
      <span class="font-medium">{{ t.captionTitle }}</span>
      <Button size="sm" variant="outline" :disabled="!edit || captioning" @click="emit('makeCaption')">
        <Loader2 v-if="captioning" class="size-3.5 animate-spin" /><Sparkles v-else class="size-3.5" /> {{ captioning ? t.captioning : t.makeCaption(captionCost) }}
      </Button>
      <Textarea :model-value="captionText" rows="4" class="text-xs" :placeholder="t.captionPh" :disabled="!edit" @change="emit('captionText', val($event))" />
      <p v-if="hashtags.length" class="text-primary text-xs">{{ hashtags.join(' ') }}</p>
      <label class="flex items-center gap-2 text-xs"><AppCheck :model-value="aiLabel" :disabled="!edit" @change="toggleLabel" />{{ t.aiLabel }}</label>
      <label v-if="credit" class="flex items-center gap-2 text-xs">{{ t.creditPlace }}
        <AppSelect :value="creditPlace" :class="sel" :disabled="!edit" :aria-label="t.creditPlace" @change="emit('settings', { creditPlace: $event })">
          <option value="caption">{{ t.creditCaption }}</option>
          <option value="page">{{ t.creditPage }}</option>
        </AppSelect>
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
      <label v-for="k in DESIGN_KINDS" :key="k" class="flex items-center gap-2 text-xs">{{ t.designDefault[k] }}
        <AppSelect :value="seriesDesign(k) ?? ''" :class="sel" :disabled="!edit" :aria-label="t.designDefault[k]" @change="emit('seriesDesign', k, $event || null)">
          <option value="">{{ t.designNone }}</option>
          <option v-for="d in designsOf(k)" :key="d.id" :value="d.id">{{ d.name }}</option>
        </AppSelect>
      </label>
      <Input id="pub-tags" :model-value="series.hashtags" class="h-8 text-xs" placeholder="#인스타툰 #공감툰" :disabled="!edit" @change="emit('series', { hashtags: val($event).slice(0, 300) })" />
    </section>

    <section class="flex flex-col gap-1.5 border-t pt-3">
      <span class="font-medium">{{ t.publishTitle }}</span>
      <StudioSocialPublish
        :accounts="{ ...(instagram ? { instagram } : {}), ...(threads ? { threads } : {}) }" :states="{ instagram: igState, threads: thState }"
        :progress="socialProgress" :posted="posted" :disabled="!edit || !!progress || !pageCount" @post="ps => emit('social', ps)"
      />
      <template v-if="published">
        <p v-for="(v, p) in posted" :key="p" class="flex flex-wrap items-center gap-x-1.5 text-xs">
          <a v-if="v!.url" :href="v!.url" target="_blank" rel="noopener" class="text-primary underline">{{ t.postLink(SOCIAL_NAMES[p]) }}</a>
          <span v-else>{{ t.postLink(SOCIAL_NAMES[p]) }}</span>
          <span class="text-emerald-700">· {{ t.postedAt(v!.at) }}</span>
        </p>
        <p v-if="published.manual" class="flex flex-wrap items-center gap-x-1.5 text-xs">
          <a v-if="published.url" :href="published.url" target="_blank" rel="noopener" class="text-primary underline">{{ t.postLink('') }}</a>
          <span v-else>{{ t.postLink('') }}</span>
          <span class="text-emerald-700">· {{ t.postedAt(published.at) }}</span>
        </p>
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
