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
const list = computed(() => lib.styles.value.filter(s => !!s.archivedAt === archived.value))
const usedBy = (id: string) => lib.series.value.filter(s => s.styleId === id).length
const current = computed(() => lib.styles.value.find(s => s.id === route.query.id) ?? null)
const select = (id?: string) => router.replace({ query: id ? { id } : {} })
async function create() {
  try { select((await lib.createStyle()).id) }
  catch (e) { toast.error(errorMessage(e) ?? ko.errors.unknown) }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 gap-6 p-6">
    <section class="flex min-w-0 flex-1 flex-col gap-4">
      <div class="flex items-center justify-between gap-2">
        <h1 class="text-xl font-semibold">
          {{ t.styles }}
        </h1>
        <Button v-if="edit" size="sm" @click="create">
          <Plus class="size-4" /> {{ t.newStyle }}
        </Button>
      </div>
      <label class="flex items-center gap-1.5 text-sm"><input v-model="archived" type="checkbox"> {{ t.archived }}</label>
      <div v-if="!lib.styles.value.length" class="text-muted-foreground flex flex-col gap-1 py-12 text-center">
        <p class="text-foreground font-medium">
          {{ ko.empty.styles.title }}
        </p>
        <p class="text-sm">
          {{ ko.empty.styles.body }}
        </p>
      </div>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] content-start gap-3 overflow-y-auto">
        <button v-for="s in list" :key="s.id" class="bg-card flex flex-col overflow-hidden rounded-lg border text-left" :class="{ 'ring-primary ring-2': s.id === current?.id }" @click="select(s.id)">
          <AppStorageImg :path="s.samples?.[0] ?? s.refImages[0]" :alt="s.name" class="aspect-[4/5] w-full" />
          <span class="truncate px-2 pt-1.5 text-sm font-medium">{{ s.name }}</span>
          <span class="text-muted-foreground px-2 pb-2 text-xs">{{ t.seriesCount(usedBy(s.id)) }}</span>
        </button>
      </div>
    </section>
    <aside v-if="current" class="w-[380px] shrink-0 overflow-y-auto border-l pl-6">
      <LibraryStyleEditor :key="current.id" :style="current" :edit="edit" @removed="select()" />
    </aside>
  </div>
</template>
