<script setup lang="ts">
import type { Series } from '#shared/episodes'
import type { DesignInfo, PageDesign, PageDesignInput } from '#shared/pagedesign'
import { Archive, ImagePlus, Trash2, X } from '@lucide/vue'
import { watchDebounced } from '@vueuse/core'
import { toast } from 'vue-sonner'
import { DESIGN_ALIGNS, pageDesignInput } from '#shared/pagedesign'
import { DEFAULT_TYPESET } from '#shared/render'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

// PUB-17 표지·끝장 디자인 편집
const props = defineProps<{ design: PageDesign, edit: boolean, series: Series[], info: DesignInfo }>()
const emit = defineEmits<{ removed: [] }>()
const pd = inject<ReturnType<typeof usePageDesigns>>('pageDesigns')!
const t = ko.library.designs
const fail = (e: unknown) => toast.error(errorMessage(e) ?? ko.errors.unknown)
const pick = (d: PageDesign): PageDesignInput => ({ name: d.name, bgColor: d.bgColor, textColor: d.textColor, align: d.align, showSeries: d.showSeries, showNumber: d.showNumber, showTitle: d.showTitle, text: d.text, titleSize: d.titleSize, textSize: d.textSize, boxed: d.boxed })
const form = reactive<PageDesignInput>(pick(props.design))
watchDebounced(form, () => {
  const p = pageDesignInput.safeParse(form)
  if (p.success) pd.update(props.design.id, p.data).catch(fail)
}, { debounce: 600, deep: true })
const live = computed<PageDesign>(() => ({ ...props.design, ...form }))
const key = computed(() => (props.design.kind === 'cover' ? 'coverDesignId' : 'outroDesignId'))

const fileInput = ref<HTMLInputElement | null>(null)
async function upload(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  if (f.size > 10 * 1024 * 1024) return toast.error(ko.library.tooBig)
  try {
    const old = props.design.imagePath
    await pd.update(props.design.id, { imagePath: await pd.upload(props.design.id, f) })
    if (old) await pd.removeFile(old)
  }
  catch (err) { fail(err) }
}
async function removeImage() {
  const old = props.design.imagePath
  await pd.update(props.design.id, { imagePath: null }).catch(fail)
  if (old) await pd.removeFile(old)
}
const setSeries = (id: string) => pd.update(props.design.id, { seriesId: id || null }).catch(fail)
const archive = () => pd.update(props.design.id, { archivedAt: props.design.archivedAt ? null : new Date() }).catch(fail)
async function remove() {
  if (!await confirmDialog(t.removeConfirm)) return
  await pd.remove(props.design.id).then(() => emit('removed'), fail)
}
const sel = 'border-input bg-card h-9 rounded-md border px-2 text-sm disabled:opacity-50'
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageRenderDesignRender :design="live" :info="info" :typeset="DEFAULT_TYPESET" class="w-full rounded-md border" />
    <div class="flex flex-col gap-1.5">
      <Label for="d-name">{{ ko.library.name }} <span class="text-muted-foreground text-xs font-normal">{{ t.kinds[design.kind] }}</span></Label>
      <Input id="d-name" v-model="form.name" :disabled="!edit" maxlength="30" />
    </div>
    <div class="flex flex-col gap-1.5">
      <span class="text-sm font-medium">{{ t.image }}</span>
      <div class="flex gap-2">
        <Button size="sm" variant="outline" :disabled="!edit" @click="fileInput?.click()">
          <ImagePlus class="size-4" /> {{ t.upload }}
        </Button>
        <Button v-if="design.imagePath" size="sm" variant="ghost" :disabled="!edit" @click="removeImage">
          <X class="size-4" /> {{ t.removeImage }}
        </Button>
      </div>
      <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="upload">
    </div>
    <div class="grid grid-cols-2 gap-2">
      <label class="flex items-center gap-2 text-xs"><input v-model="form.bgColor" type="color" class="size-8 rounded border" :disabled="!edit" :aria-label="t.bgColor">{{ t.bgColor }}</label>
      <label class="flex items-center gap-2 text-xs"><input v-model="form.textColor" type="color" class="size-8 rounded border" :disabled="!edit" :aria-label="t.textColor">{{ t.textColor }}</label>
    </div>
    <div class="flex flex-col gap-1.5">
      <span class="text-sm font-medium">{{ t.show }}</span>
      <div class="flex flex-wrap gap-3">
        <label class="flex items-center gap-1.5 text-xs"><AppCheck v-model="form.showSeries" :disabled="!edit" />{{ t.showSeries }}</label>
        <label class="flex items-center gap-1.5 text-xs"><AppCheck v-model="form.showNumber" :disabled="!edit" />{{ t.showNumber }}</label>
        <label class="flex items-center gap-1.5 text-xs"><AppCheck v-model="form.showTitle" :disabled="!edit" />{{ t.showTitle }}</label>
      </div>
      <Label for="d-text" class="text-xs">{{ t.text }}</Label>
      <Textarea id="d-text" v-model="form.text" rows="3" maxlength="300" :placeholder="t.textPh[design.kind]" :disabled="!edit" />
    </div>
    <div class="grid grid-cols-2 gap-2">
      <label class="flex flex-col gap-1 text-xs">{{ t.titleSize(form.titleSize) }}<input v-model.number="form.titleSize" type="range" min="40" max="160" step="4" :disabled="!edit"></label>
      <label class="flex flex-col gap-1 text-xs">{{ t.textSize(form.textSize) }}<input v-model.number="form.textSize" type="range" min="20" max="80" step="2" :disabled="!edit"></label>
    </div>
    <label class="flex items-center gap-2 text-xs">{{ t.align }}
      <AppSelect v-model="form.align" :class="sel" :disabled="!edit">
        <option v-for="a in DESIGN_ALIGNS" :key="a" :value="a">{{ t.aligns[a] }}</option>
      </AppSelect>
    </label>
    <label class="flex items-center gap-2 text-xs"><AppCheck v-model="form.boxed" :disabled="!edit" />{{ t.boxed }}</label>

    <label v-if="series.length" class="flex items-center gap-2 text-xs">{{ t.series }}
      <AppSelect :value="design.seriesId ?? ''" :class="sel" :disabled="!edit" @change="setSeries">
        <option value="">{{ t.allSeries }}</option>
        <option v-for="s in series" :key="s.id" :value="s.id">{{ s.name }}</option>
      </AppSelect>
    </label>
    <div v-if="series.length" class="flex flex-col gap-1.5">
      <span class="text-sm font-medium">{{ t.defaultIn }}</span>
      <label v-for="s in series" :key="s.id" class="flex items-center gap-2 text-sm">
        <AppCheck :model-value="s[key] === design.id" :disabled="!edit" @change="pd.setSeriesDefault(s.id, design.kind, $event ? design.id : null).catch(fail)" />
        {{ s.name }}
      </label>
    </div>

    <div v-if="edit" class="flex gap-2 border-t pt-3">
      <Button size="sm" variant="outline" @click="archive">
        <Archive class="size-4" /> {{ design.archivedAt ? ko.library.unarchive : ko.library.archive }}
      </Button>
      <Button size="sm" variant="ghost" @click="remove">
        <Trash2 class="size-4" /> {{ t.remove }}
      </Button>
    </div>
  </div>
</template>
