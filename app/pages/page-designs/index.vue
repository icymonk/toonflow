<script setup lang="ts">
import type { DesignKind, PageDesign } from '#shared/pagedesign'
import { Plus } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { DESIGN_KINDS } from '#shared/pagedesign'
import { DEFAULT_TYPESET } from '#shared/render'
import { canEdit } from '#shared/roles'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

// PUB-17 표지·끝장 디자인 목록 + 편집
const t = ko.library.designs
const auth = useAuthStore()
const edit = computed(() => canEdit(auth.role))
const pd = usePageDesigns()
provide('pageDesigns', pd)
const { series } = useStories()
const seriesFilter = useSeriesFilter(series)
const route = useRoute()
const router = useRouter()
const kind = computed<DesignKind>(() => (route.query.kind === 'outro' ? 'outro' : 'cover'))
const archived = ref(false)
const list = computed(() => pd.list.value.filter(d => d.kind === kind.value && !!d.archivedAt === archived.value && (!seriesFilter.value || !d.seriesId || d.seriesId === seriesFilter.value)))
const current = computed(() => pd.list.value.find(d => d.id === route.query.id) ?? null)
const select = (id?: string, k: DesignKind = kind.value) => router.replace({ query: { kind: k, ...(id ? { id } : {}) } })
const key = (k: DesignKind) => (k === 'cover' ? 'coverDesignId' : 'outroDesignId')
const infoOf = (d: PageDesign) => ({ series: series.value.find(s => s.id === (d.seriesId || seriesFilter.value))?.name ?? t.sampleSeries, number: 1, title: t.sampleTitle })
const usedBy = (d: PageDesign) => series.value.filter(s => s[key(d.kind)] === d.id).length
async function create() {
  try {
    const id = (await pd.create(kind.value, seriesFilter.value || null)).id
    // 고른 작품에 아직 기본이 없으면 이걸 기본으로
    const s = series.value.find(x => x.id === seriesFilter.value)
    if (s && !s[key(kind.value)]) await pd.setSeriesDefault(s.id, kind.value, id)
    select(id)
  }
  catch (e) { toast.error(errorMessage(e) ?? ko.errors.unknown) }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 gap-6 p-4 lg:p-6">
    <section class="min-w-0 flex-1 flex-col gap-4" :class="current ? 'hidden lg:flex' : 'flex'">
      <div class="flex items-center justify-between gap-2">
        <h1 class="text-xl font-semibold">
          {{ t.title }}
        </h1>
        <Button v-if="edit" size="sm" @click="create">
          <Plus class="size-4" /> {{ t.create(t.kinds[kind]) }}
        </Button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div class="bg-muted flex rounded-md p-0.5" role="tablist">
          <button
            v-for="k in DESIGN_KINDS" :key="k" role="tab" :aria-selected="k === kind" class="rounded px-3 py-1 text-sm"
            :class="k === kind ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground'" @click="select(undefined, k)"
          >
            {{ t.kinds[k] }}
          </button>
        </div>
        <AppSeriesScope />
        <label class="flex items-center gap-1.5 text-sm"><AppCheck v-model="archived" /> {{ ko.library.archived }}</label>
      </div>
      <AppListSkeleton v-if="!pd.loaded.value" />
      <div v-else-if="!list.length" class="text-muted-foreground flex flex-col gap-1 py-12 text-center">
        <p class="text-foreground font-medium">
          {{ t.empty }}
        </p>
        <p class="text-sm">
          {{ t.emptyBody }}
        </p>
      </div>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] content-start gap-3 overflow-y-auto">
        <button v-for="d in list" :key="d.id" class="bg-card flex flex-col overflow-hidden rounded-lg border text-left" :class="{ 'ring-primary ring-2': d.id === current?.id }" @click="select(d.id)">
          <PageRenderDesignRender :design="d" :info="infoOf(d)" :typeset="DEFAULT_TYPESET" class="w-full border-b" />
          <span class="truncate px-2 pt-1.5 text-sm font-medium">{{ d.name }}</span>
          <span class="text-muted-foreground px-2 pb-2 text-xs">{{ t.defaultCount(usedBy(d)) }}</span>
        </button>
      </div>
    </section>
    <aside v-if="current" class="flex w-full min-w-0 flex-col gap-3 overflow-y-auto lg:w-[380px] lg:shrink-0 lg:border-l lg:pl-6">
      <Button variant="ghost" size="sm" class="self-start lg:hidden" @click="select()">
        {{ ko.library.backToList }}
      </Button>
      <LibraryPageDesignEditor :key="current.id" :design="current" :edit="edit" :series="series" :info="infoOf(current)" @removed="select()" />
    </aside>
  </div>
</template>
