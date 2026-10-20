<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { canEdit } from '#shared/roles'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

// CHR-07 목록 (카드·작품 필터·검색) + 편집
const t = ko.library
const auth = useAuthStore()
const edit = computed(() => canEdit(auth.role))
const lib = useLibrary()
provide('lib', lib)
const route = useRoute()
const router = useRouter()
const q = ref('')
const seriesFilter = useSeriesFilter(lib.series)
const archived = ref(false)
const seriesOf = (id: string) => lib.series.value.filter(s => s.mainCharacterIds?.includes(id))
const list = computed(() => lib.characters.value.filter(c => !!c.archivedAt === archived.value
  && (!q.value.trim() || [c.name, ...c.aliases].some(n => n.includes(q.value.trim())))
  && (!seriesFilter.value || seriesOf(c.id).some(s => s.id === seriesFilter.value))))
const current = computed(() => lib.characters.value.find(c => c.id === route.query.id) ?? null)
const select = (id?: string) => router.replace({ query: id ? { id } : {} })
async function create() {
  try {
    const id = (await lib.createCharacter({ name: t.newCharacter })).id
    if (seriesFilter.value) await lib.setMain(seriesFilter.value, id, true)
    select(id)
  }
  catch (e) { toast.error(errorMessage(e) ?? ko.errors.unknown) }
}
const selectClass = 'border-input bg-card h-9 rounded-md border px-2 text-sm'
</script>

<template>
  <div class="flex min-h-0 flex-1 gap-6 p-4 lg:p-6">
    <section class="min-w-0 flex-1 flex-col gap-4" :class="current ? 'hidden lg:flex' : 'flex'">
      <div class="flex items-center justify-between gap-2">
        <h1 class="text-xl font-semibold">
          {{ t.characters }}
        </h1>
        <Button v-if="edit" size="sm" @click="create">
          <Plus class="size-4" /> {{ t.newCharacter }}
        </Button>
      </div>
      <div class="flex flex-wrap gap-2">
        <Input v-model="q" :placeholder="t.search" :aria-label="t.search" class="w-48" />
        <AppSelect v-model="seriesFilter" :class="selectClass" :aria-label="t.allSeries">
          <option value="">
            {{ t.allSeries }}
          </option>
          <option v-for="s in lib.series.value" :key="s.id" :value="s.id">
            {{ s.name }}
          </option>
        </AppSelect>
        <label class="flex items-center gap-1.5 text-sm"><AppCheck v-model="archived" /> {{ t.archived }}</label>
      </div>
      <AppListSkeleton v-if="!lib.loaded.characters" />
      <div v-else-if="!lib.characters.value.length" class="text-muted-foreground flex flex-col gap-1 py-12 text-center">
        <p class="text-foreground font-medium">
          {{ ko.empty.characters.title }}
        </p>
        <p class="text-sm">
          {{ ko.empty.characters.body }}
        </p>
      </div>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] content-start gap-3 overflow-y-auto">
        <button v-for="c in list" :key="c.id" class="bg-card flex flex-col overflow-hidden rounded-lg border text-left" :class="{ 'ring-primary ring-2': c.id === current?.id }" @click="select(c.id)">
          <AppStorageImg :path="c.coverPath" :alt="c.name" class="aspect-square w-full" />
          <span class="truncate px-2 pt-1.5 text-sm font-medium">{{ c.name }}</span>
          <span class="text-muted-foreground truncate px-2 pb-2 text-xs">{{ c.episodeId ? t.episodeOnly : seriesOf(c.id).map(s => s.name).join(', ') || c.intro }}</span>
        </button>
      </div>
    </section>
    <aside v-if="current" class="flex w-full min-w-0 flex-col gap-3 overflow-y-auto lg:w-[380px] lg:shrink-0 lg:border-l lg:pl-6">
      <Button variant="ghost" size="sm" class="self-start lg:hidden" @click="select()">
        {{ t.backToList }}
      </Button>
      <LibraryCharacterEditor :key="current.id" :character="current" :edit="edit" @removed="select()" />
    </aside>
  </div>
</template>
