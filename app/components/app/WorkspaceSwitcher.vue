<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { toast } from 'vue-sonner'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

// ACC-12: 사이드바 위 워크스페이스 이름을 눌러 전환·새로 만들기
defineProps<{ collapsed: boolean }>()
const auth = useAuthStore()
const t = ko.workspaces
const open = ref(false)
const root = ref<HTMLElement | null>(null)
onClickOutside(root, () => (open.value = false))

async function toggle() {
  open.value = !open.value
  if (open.value) await auth.loadWorkspaces().catch(() => {})
}
async function attempt(fn: () => Promise<void>) {
  try {
    await fn()
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.unknown)
  }
}
const go = (id: string) => (id === auth.workspace?.id ? (open.value = false) : attempt(() => auth.switchTo(id)))
async function create() {
  const name = (await promptDialog(t.createPrompt))?.trim()
  if (name) return attempt(() => auth.createWorkspace(name.slice(0, 40)))
}
</script>

<template>
  <div v-if="!collapsed" ref="root" class="relative pb-3">
    <button type="button" class="hover:bg-sidebar-accent flex w-full items-center gap-1 rounded-md px-3 py-1 text-left text-xs opacity-80" :aria-expanded="open" :aria-label="t.switch" @click="toggle">
      <span class="truncate">{{ auth.workspace?.name }}</span>
      <span aria-hidden="true">▾</span>
    </button>
    <div v-if="open" role="menu" class="bg-popover text-popover-foreground absolute inset-x-0 top-full z-30 mt-1 flex max-h-80 min-w-0 flex-col overflow-y-auto rounded-md border p-1 text-sm shadow-md">
      <p v-if="!auth.workspaces.length" class="text-muted-foreground px-2 py-1 text-xs">{{ t.loading }}</p>
      <button v-for="w in auth.workspaces" :key="w.id" type="button" role="menuitem" class="hover:bg-muted flex items-center gap-2 rounded px-2 py-1.5 text-left" @click="go(w.id)">
        <span class="flex-1 truncate">{{ w.name }}</span>
        <span v-if="w.deleteAt" class="text-destructive text-xs">{{ t.scheduled }}</span>
        <span v-else-if="w.id === auth.workspace?.id" class="text-muted-foreground text-xs">{{ t.current }}</span>
      </button>
      <button type="button" role="menuitem" class="hover:bg-muted mt-1 rounded border-t px-2 py-1.5 text-left" @click="create">+ {{ t.create }}</button>
    </div>
  </div>
</template>
