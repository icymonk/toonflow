<script setup lang="ts">
import type { Snapshot } from '#shared/snapshot'
import { X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { snapshotDiff } from '#shared/snapshot'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

const props = defineProps<{ s: ReturnType<typeof useStudio>, edit: boolean }>()
const emit = defineEmits<{ close: [] }>()
const t = ko.studio.snap

const name = ref('')
const busy = ref(false)
const openId = ref<string | null>(null)
const when = (x: Snapshot) => (x.createdAt ? new Date(x.createdAt.toMillis()).toLocaleString('ko-KR') : '')
const diff = computed(() => {
  const snap = props.s.snapshots.value.find(x => x.id === openId.value)
  return snap && props.s.episode.value ? snapshotDiff(snap, props.s.currentSnapshot()) : null
})
const noDiff = computed(() => !!diff.value && !diff.value.title && !diff.value.added && !diff.value.removed && !diff.value.changed.length && diff.value.pages[0] === diff.value.pages[1])

async function act(fn: () => Promise<unknown>, done: string) {
  busy.value = true
  try {
    await fn()
    toast(done)
  }
  catch (e) {
    toast.error(e instanceof Error && e.message === 'snapshot-too-large' ? t.tooLarge : (errorMessage(e) ?? ko.errors.unknown))
  }
  finally {
    busy.value = false
  }
}
const save = () => act(async () => {
  await props.s.saveSnapshot(name.value || new Date().toLocaleString('ko-KR'))
  name.value = ''
}, t.saved)
function restore(x: Snapshot) {
  if (!window.confirm(t.restoreConfirm(x.name))) return
  act(() => props.s.restoreSnapshot(x, t.backupName(new Date().toLocaleString('ko-KR'))), t.restored).then(() => emit('close'))
}
function remove(x: Snapshot) {
  if (window.confirm(t.removeConfirm(x.name))) act(() => props.s.removeSnapshot(x.id), t.remove)
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" :aria-label="t.title" @click.self="emit('close')">
    <div class="bg-background flex max-h-[80vh] w-[32rem] flex-col gap-3 overflow-y-auto rounded-lg p-5 shadow-lg">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold">{{ t.title }}</h2>
        <button :aria-label="ko.studio.close" @click="emit('close')"><X class="size-5" /></button>
      </div>
      <p class="text-muted-foreground text-xs">{{ t.hint }}</p>
      <form v-if="edit" class="flex gap-2" @submit.prevent="save">
        <Input v-model="name" maxlength="40" :placeholder="t.namePlaceholder" :aria-label="t.namePlaceholder" />
        <Button type="submit" :disabled="busy">{{ t.save }}</Button>
      </form>
      <p v-if="!s.snapshots.value.length" class="text-muted-foreground py-4 text-center text-sm">{{ t.empty }}</p>
      <ul class="flex flex-col gap-2">
        <li v-for="x in s.snapshots.value" :key="x.id" class="rounded-md border p-3 text-sm">
          <div class="flex items-center gap-2">
            <span class="font-medium">{{ x.name }}</span>
            <span class="text-muted-foreground text-xs">{{ when(x) }} · {{ t.cuts(x.panels.length) }}</span>
            <span class="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" :aria-pressed="openId === x.id" @click="openId = openId === x.id ? null : x.id">{{ t.compare }}</Button>
              <template v-if="edit">
                <Button size="sm" variant="outline" :disabled="busy" @click="restore(x)">{{ t.restore }}</Button>
                <Button size="sm" variant="ghost" :disabled="busy" @click="remove(x)">{{ t.remove }}</Button>
              </template>
            </span>
          </div>
          <div v-if="openId === x.id && diff" class="bg-muted mt-2 flex flex-col gap-1 rounded p-2 text-xs">
            <p v-if="noDiff">{{ t.noDiff }}</p>
            <template v-else>
              <p v-if="diff.title">{{ t.diffTitle }}</p>
              <p v-if="diff.pages[0] !== diff.pages[1]">{{ t.diffPages(diff.pages[0], diff.pages[1]) }}</p>
              <p v-if="diff.added || diff.removed">{{ t.diffCuts(diff.added, diff.removed) }}</p>
              <p v-for="c in diff.changed" :key="c.panelId" class="truncate">
                <span class="font-medium">{{ c.scene || '—' }}</span> · {{ t.changed(c.kinds.map(k => t.kinds[k]).join(', ')) }}
              </p>
            </template>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
