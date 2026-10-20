<script setup lang="ts">
import { zipSync } from 'fflate'
import { toast } from 'vue-sonner'
import { formatBytes } from '#shared/assets'
import { ko } from '~/locales/ko'

// AST-01~08
const t = ko.assetsPage
const a = useAssets()
const tpl = useBubbleTemplates()
const { series, episodes } = useStories()
const seriesFilter = useSeriesFilter(series)
const seriesEpisodes = computed(() => episodes.value.filter(e => !seriesFilter.value || e.seriesId === seriesFilter.value))
watch(seriesFilter, () => (ep.value = ''))
const tab = ref<'generated' | 'refs'>('generated')
const ep = ref('')
const q = ref('')
const tagInput = ref('')
const sel = ref(new Set<string>())
const focus = ref<string | null>(null)
const days = ref(30)
const usage = ref<{ ai: number, refs: number, total: number } | null>(null)
const splitTags = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean).slice(0, 10)
const sceneOf = (g: { input?: unknown }) => (g.input as { scene?: string } | null)?.scene ?? ''
const styleVer = (g: { input?: unknown }) => (g.input as { styleVersion?: number | null } | null)?.styleVersion ?? null
const epTitle = (id: string | null) => episodes.value.find(e => e.id === id)?.title ?? ''
const inSeries = (episodeId: string | null) => !seriesFilter.value || seriesEpisodes.value.some(e => e.id === episodeId)
const gen = computed(() => a.generated.value.filter(g => inSeries(g.episodeId) && (!ep.value || g.episodeId === ep.value) && (!q.value.trim() || sceneOf(g).includes(q.value.trim()))))
const refs = computed(() => a.assets.value.filter(x => (!seriesFilter.value || x.seriesId === seriesFilter.value) && (!q.value.trim() || x.name.includes(q.value.trim()) || x.tags.some(tg => tg.includes(q.value.trim())))))
const items = computed(() => (tab.value === 'generated' ? gen.value.map(g => ({ id: g.id, path: g.imagePath })) : refs.value.map(r => ({ id: r.id, path: r.path }))))
const fGen = computed(() => (tab.value === 'generated' ? gen.value.find(g => g.id === focus.value) : undefined))
const fRef = computed(() => (tab.value === 'refs' ? refs.value.find(r => r.id === focus.value) : undefined))
watch(tab, () => {
  sel.value = new Set()
  focus.value = null
})
function toggle(id: string) {
  const s = new Set(sel.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  sel.value = s
}
onMounted(async () => {
  usage.value = await a.usage().catch(() => null)
})
async function upload(files: File[]) {
  const imgs = files.filter(f => f.type.startsWith('image/'))
  if (!imgs.length) return
  try {
    await a.upload(imgs, splitTags(tagInput.value), seriesFilter.value || null)
    toast.success(t.uploaded(imgs.length))
    tab.value = 'refs'
  }
  catch { toast.error(ko.errors.unknown) }
}
async function download() {
  const paths = items.value.filter(i => sel.value.has(i.id)).map(i => i.path)
  if (!paths.length) return
  try {
    const files = await Promise.all(paths.map(async p => [p.split('/').pop()!, new Uint8Array(await (await a.blob(p)).arrayBuffer())] as [string, Uint8Array]))
    const one = files.length === 1
    const data = one ? files[0]![1] : zipSync(Object.fromEntries(files.map(([n, d]) => [n, [d, { level: 0 }] as [Uint8Array, { level: 0 }]])))
    const url = URL.createObjectURL(new Blob([data as BlobPart]))
    const el = document.createElement('a')
    el.href = url
    el.download = one ? files[0]![0] : 'toonflow-assets.zip'
    el.click()
    URL.revokeObjectURL(url)
  }
  catch { toast.error(t.downloadFailed) }
}
async function cleanup() {
  if (!await confirmDialog(t.cleanupConfirm(days.value))) return
  try {
    const r = await a.cleanup(days.value)
    toast.success(t.cleaned(r.deleted))
    usage.value = await a.usage().catch(() => null)
  }
  catch { toast.error(ko.errors.unknown) }
}
const tabClass = (on: boolean) => (on ? 'border-primary font-medium' : 'border-transparent text-muted-foreground')
</script>

<template>
  <div class="flex h-full min-h-0 gap-4 p-4">
    <div class="min-w-0 flex-1 flex-col gap-3" :class="fGen || fRef ? 'hidden lg:flex' : 'flex'">
      <div class="flex flex-wrap items-center gap-3 border-b">
        <button class="border-b-2 px-1 pb-2 text-sm" :class="tabClass(tab === 'generated')" @click="tab = 'generated'">{{ t.generated }} {{ a.generated.value.length }}</button>
        <button class="border-b-2 px-1 pb-2 text-sm" :class="tabClass(tab === 'refs')" @click="tab = 'refs'">{{ t.refs }} {{ a.assets.value.length }}</button>
        <span v-if="usage" class="text-muted-foreground ml-auto pb-2 text-xs">{{ t.usage }} {{ formatBytes(usage.total) }} · {{ t.usageLine(formatBytes(usage.ai), formatBytes(usage.refs)) }}</span>
      </div>
      <details v-if="tpl.templates.value.length" class="text-sm">
        <summary class="text-muted-foreground cursor-pointer">{{ t.templates(tpl.templates.value.length) }}</summary>
        <ul class="mt-2 flex flex-wrap gap-2">
          <li v-for="tp in tpl.templates.value" :key="tp.id" class="flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
            {{ tp.name }} · {{ ko.studio.review.shapes[tp.shape] }} · {{ tp.fontSize }}
            <button class="text-muted-foreground hover:text-destructive" :aria-label="t.remove" @click="tpl.remove(tp.id)">×</button>
          </li>
        </ul>
      </details>
      <div class="flex flex-wrap items-center gap-2">
        <AppSelect v-model="seriesFilter" class="border-input bg-card h-9 rounded-md border px-2 text-sm" :aria-label="ko.library.allSeries">
          <option value="">{{ ko.library.allSeries }}</option>
          <option v-for="s in series" :key="s.id" :value="s.id">{{ s.name }}</option>
        </AppSelect>
        <AppSelect v-if="tab === 'generated'" v-model="ep" class="border-input bg-card h-9 rounded-md border px-2 text-sm">
          <option value="">{{ t.allEpisodes }}</option>
          <option v-for="e in seriesEpisodes" :key="e.id" :value="e.id">{{ e.title }}</option>
        </AppSelect>
        <Input v-model="q" class="h-9 w-full sm:w-60" :placeholder="t.search" />
        <Button size="sm" variant="outline" :disabled="!sel.size" @click="download">{{ t.download(sel.size) }}</Button>
        <template v-if="tab === 'refs'">
          <Input v-model="tagInput" class="h-9 w-48" :placeholder="t.tagsPh" />
          <label class="hover:bg-muted cursor-pointer rounded-md border px-3 py-1.5 text-sm">{{ t.upload }}<input type="file" accept="image/*" multiple class="hidden" @change="e => { upload([...((e.target as HTMLInputElement).files ?? [])]); (e.target as HTMLInputElement).value = '' }"></label>
        </template>
        <template v-else>
          <span class="ml-auto flex items-center gap-1 text-xs">
            <Input v-model.number="days" type="number" min="0" max="365" class="h-8 w-16" />{{ t.cleanupDays }}
            <Button size="sm" variant="outline" @click="cleanup">{{ t.cleanup }}</Button>
          </span>
        </template>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto rounded-md" @dragover.prevent @drop.prevent="e => upload([...(e.dataTransfer?.files ?? [])])">
        <AppListSkeleton v-if="!(tab === 'generated' ? a.loaded.generated : a.loaded.assets)" />
        <p v-else-if="!items.length" class="text-muted-foreground p-6 text-center text-sm">{{ t.empty }}<br><span v-if="tab === 'refs'" class="text-xs">{{ t.drop }}</span></p>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
          <div v-for="i in items" :key="i.id" class="group relative overflow-hidden rounded-md border" :class="{ 'ring-primary ring-2': focus === i.id }">
            <button class="block w-full" @click="focus = i.id"><AppStorageImg :path="i.path" class="aspect-[4/5] w-full" /></button>
            <AppCheck class="absolute top-1.5 left-1.5 size-4" :model-value="sel.has(i.id)" :aria-label="t.select" @change="toggle(i.id)" />
          </div>
        </div>
      </div>
    </div>
    <aside v-if="fGen || fRef" class="flex w-full min-w-0 flex-col gap-2 overflow-y-auto text-sm lg:w-72 lg:shrink-0 lg:border-l lg:pl-4">
      <Button variant="ghost" size="sm" class="self-start lg:hidden" @click="focus = null">
        {{ t.backToList }}
      </Button>
      <h3 class="font-semibold">{{ t.detail }}</h3>
      <AppStorageImg :path="fGen?.imagePath ?? fRef!.path" class="aspect-[4/5] w-full rounded-md border" />
      <template v-if="fGen">
        <p><span class="text-muted-foreground text-xs">{{ t.source }}</span><br>{{ t.sources[fGen.source as keyof typeof t.sources] ?? fGen.source }}</p>
        <p v-if="fGen.episodeId"><span class="text-muted-foreground text-xs">{{ t.episode }}</span><br>
          <NuxtLink class="underline" :to="`/studio?episode=${fGen.episodeId}&step=illustrate&panel=${fGen.panelId}`">{{ epTitle(fGen.episodeId) || fGen.episodeId }}</NuxtLink></p>
        <p v-if="styleVer(fGen)" class="text-muted-foreground text-xs">{{ t.styleVersion(styleVer(fGen)!) }}</p>
        <p v-if="sceneOf(fGen)"><span class="text-muted-foreground text-xs">{{ t.scene }}</span><br>{{ sceneOf(fGen) }}</p>
      </template>
      <template v-else-if="fRef">
        <p class="break-all">{{ fRef.name }} · {{ formatBytes(fRef.size) }}</p>
        <Label class="text-xs">{{ t.tags }}</Label>
        <Input :model-value="fRef.tags.join(', ')" @change="(e: Event) => a.setTags(fRef!.id, splitTags((e.target as HTMLInputElement).value))" />
        <Label class="text-xs">{{ t.series }}</Label>
        <AppSelect :model-value="fRef.seriesId ?? ''" class="border-input bg-card h-9 rounded-md border px-2 text-sm" :aria-label="t.series" @update:model-value="(v: string) => a.setSeries(fRef!.id, v || null)">
          <option value="">{{ t.sharedAll }}</option>
          <option v-for="s in series" :key="s.id" :value="s.id">{{ s.name }}</option>
        </AppSelect>
        <Button size="sm" variant="ghost" class="text-destructive self-start" @click="a.remove(fRef!).then(() => (focus = null))">{{ t.remove }}</Button>
      </template>
    </aside>
  </div>
</template>
