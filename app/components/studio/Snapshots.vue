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

// 추천 입력: 지금 단계·시각으로 이름을 미리 채우고, 칩으로 바꿀 수 있다
const stamp = () => new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
const stage = () => ko.stories.stages[props.s.episode.value?.step ?? 'story']
const defaultName = () => `${t.done(stage())} · ${stamp()}`
const name = ref(defaultName())
const nameChips = computed(() => [t.done(stage()), ...t.chips])
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
  await props.s.saveSnapshot(name.value.trim() || defaultName())
  name.value = defaultName()
}, t.saved)
async function restore(x: Snapshot) {
  if (!await confirmDialog(t.restoreConfirm(x.name))) return
  act(() => props.s.restoreSnapshot(x, t.backupName(new Date().toLocaleString('ko-KR'))), t.restored).then(() => emit('close'))
}
async function remove(x: Snapshot) {
  if (await confirmDialog(t.removeConfirm(x.name))) act(() => props.s.removeSnapshot(x.id), t.remove)
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
      <form v-if="edit" class="flex flex-col gap-1.5" @submit.prevent="save">
        <div class="flex gap-2">
          <Input v-model="name" maxlength="40" :placeholder="t.namePlaceholder" :aria-label="t.nameLabel" />
          <Button type="submit" :loading="busy">{{ t.save }}</Button>
        </div>
        <AppSuggest :label="t.nameLabel" :items="nameChips" @pick="v => (name = `${v} · ${stamp()}`)" />
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
                <Button size="sm" variant="outline" :loading="busy" @click="restore(x)">{{ t.restore }}</Button>
                <Button size="sm" variant="ghost" :loading="busy" @click="remove(x)">{{ t.remove }}</Button>
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
