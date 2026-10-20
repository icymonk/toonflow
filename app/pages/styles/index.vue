<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { canEdit } from '#shared/roles'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

// STL-09 목록 (샘플 카드·쓰는 작품 수) + 편집
const t = ko.library
const auth = useAuthStore()
const edit = computed(() => canEdit(auth.role))
const lib = useLibrary()
provide('lib', lib)
const route = useRoute()
const router = useRouter()
const archived = ref(false)
const seriesFilter = useSeriesFilter(lib.series)
const filterStyleId = computed(() => lib.series.value.find(s => s.id === seriesFilter.value)?.styleId ?? null)
const list = computed(() => lib.styles.value.filter(s => !!s.archivedAt === archived.value && (!seriesFilter.value || s.id === filterStyleId.value)))
// STL-05 비교
const compareId = ref('')
const compareWith = computed(() => lib.styles.value.find(s => s.id === compareId.value && s.id !== current.value?.id) ?? null)
const usedBy = (id: string) => lib.series.value.filter(s => s.styleId === id).length
const current = computed(() => lib.styles.value.find(s => s.id === route.query.id) ?? null)
const select = (id?: string) => router.replace({ query: id ? { id } : {} })
async function create() {
  try {
    const id = (await lib.createStyle()).id
    // 작품마다 그림체는 하나라서, 아직 없는 작품에만 연결
    if (seriesFilter.value && !filterStyleId.value) await lib.setSeriesStyle(seriesFilter.value, id)
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
          {{ t.styles }}
        </h1>
        <Button v-if="edit" size="sm" @click="create">
          <Plus class="size-4" /> {{ t.newStyle }}
        </Button>
      </div>
      <div class="flex flex-wrap gap-2">
        <AppSelect v-model="seriesFilter" class="border-input bg-card h-9 rounded-md border px-2 text-sm" :aria-label="t.allSeries">
          <option value="">
            {{ t.allSeries }}
          </option>
          <option v-for="s in lib.series.value" :key="s.id" :value="s.id">
            {{ s.name }}
          </option>
        </AppSelect>
        <label class="flex items-center gap-1.5 text-sm"><AppCheck v-model="archived" /> {{ t.archived }}</label>
      </div>
      <AppListSkeleton v-if="!lib.loaded.styles" />
      <div v-else-if="!lib.styles.value.length" class="text-muted-foreground flex flex-col gap-1 py-12 text-center">
        <p class="text-foreground font-medium">
          {{ ko.empty.styles.title }}
        </p>
        <p class="text-sm">
          {{ ko.empty.styles.body }}
        </p>
      </div>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] content-start gap-3 overflow-y-auto">
        <button v-for="s in list" :key="s.id" class="bg-card flex flex-col overflow-hidden rounded-lg border text-left" :class="{ 'ring-primary ring-2': s.id === current?.id }" @click="select(s.id)">
          <AppStorageImg :path="s.samples?.[0] ?? s.refImages[0]" :alt="s.name" class="aspect-[4/5] w-full" />
          <span class="truncate px-2 pt-1.5 text-sm font-medium">{{ s.name }}</span>
          <span class="text-muted-foreground px-2 pb-2 text-xs">{{ t.seriesCount(usedBy(s.id)) }}</span>
        </button>
      </div>
      <div v-if="current && lib.styles.value.length > 1" class="flex flex-col gap-2 border-t pt-3">
        <label class="flex items-center gap-2 text-sm">{{ t.compareWith }}
          <AppSelect v-model="compareId" class="border-input bg-card h-8 rounded-md border px-2 text-sm">
            <option value="">-</option>
            <option v-for="s in lib.styles.value.filter(x => x.id !== current!.id)" :key="s.id" :value="s.id">{{ s.name }}</option>
          </AppSelect>
        </label>
        <div v-if="compareWith" class="grid grid-cols-2 gap-3">
          <div v-for="s in [current, compareWith]" :key="s.id" class="flex flex-col gap-1">
            <span class="text-sm font-medium">{{ s.name }} · v{{ s.version ?? 1 }}</span>
            <div class="grid grid-cols-3 gap-1">
              <AppStorageImg v-for="p in (s.samples?.length ? s.samples : s.refImages)" :key="p" :path="p" class="aspect-[4/5] w-full rounded" />
            </div>
          </div>
        </div>
      </div>
    </section>
    <aside v-if="current" class="flex w-full min-w-0 flex-col gap-3 overflow-y-auto lg:w-[380px] lg:shrink-0 lg:border-l lg:pl-6">
      <Button variant="ghost" size="sm" class="self-start lg:hidden" @click="select()">
        {{ t.backToList }}
      </Button>
      <LibraryStyleEditor :key="current.id" :style="current" :edit="edit" @removed="select()" />
    </aside>
  </div>
</template>
