<script setup lang="ts">
import type { TrashKind } from '#shared/trash'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { toast } from 'vue-sonner'
import { daysLeft, TRASH_COLLECTION, TRASH_KINDS } from '#shared/trash'
import { callFn } from '~/lib/functions'
import { ko } from '~/locales/ko'

// CMN-30 휴지통
const t = ko.trash
const { $firestore, $functions } = useNuxtApp()
const auth = useAuthStore()
interface Item { kind: TrashKind, id: string, name: string, deletedMs: number }
const byKind = reactive<Record<string, Item[]>>({})
const stops: (() => void)[] = []
watch(() => auth.workspace?.id, (w) => {
  stops.splice(0).forEach(f => f())
  if (!w) return
  for (const kind of TRASH_KINDS) {
    stops.push(onSnapshot(query(collection($firestore, 'workspaces', w, TRASH_COLLECTION[kind]), where('deletedAt', '!=', null)), (snap) => {
      byKind[kind] = snap.docs.map((d) => {
        const x = d.data()
        return { kind, id: d.id, name: String(x.title ?? x.name ?? ''), deletedMs: x.deletedAt?.toMillis?.() ?? Date.now() }
      })
    }, () => {}))
  }
}, { immediate: true })
onScopeDispose(() => stops.forEach(f => f()))
const items = computed(() => Object.values(byKind).flat().sort((a, b) => b.deletedMs - a.deletedMs))
const busy = ref<string | null>(null)
async function act(it: Item, purge: boolean) {
  if (purge && !window.confirm(t.purgeConfirm(it.name))) return
  busy.value = it.id
  try {
    await callFn($functions, purge ? 'purgeFromTrash' : 'restoreFromTrash', { workspaceId: auth.workspace!.id, kind: it.kind, id: it.id })
    toast.success(purge ? t.purged : t.restored)
  }
  catch { toast.error(t.failed) }
  finally { busy.value = null }
}
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-4 p-8">
    <div>
      <h1 class="text-xl font-bold">{{ t.title }}</h1>
      <p class="text-muted-foreground text-sm">{{ t.note }}</p>
    </div>
    <p v-if="!items.length" class="text-muted-foreground text-sm">{{ t.empty }}</p>
    <div v-for="it in items" :key="`${it.kind}/${it.id}`" class="bg-card flex items-center gap-3 rounded-lg border px-4 py-3">
      <span class="bg-muted rounded px-1.5 py-0.5 text-xs">{{ t.kinds[it.kind] }}</span>
      <span class="flex-1 truncate text-sm">{{ it.name }}</span>
      <span class="text-muted-foreground text-xs">{{ t.daysLeft(daysLeft(it.deletedMs, Date.now())) }}</span>
      <Button size="sm" variant="outline" :disabled="busy === it.id" @click="act(it, false)">{{ t.restore }}</Button>
      <Button size="sm" variant="ghost" class="text-destructive" :disabled="busy === it.id" @click="act(it, true)">{{ t.purge }}</Button>
    </div>
  </div>
</template>
