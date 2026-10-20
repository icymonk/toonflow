<script setup lang="ts">
import { ListTodo, LogOut, Menu, MessageSquare, MessageSquarePlus, Monitor, Moon, PanelLeft, Search, Sun, Trash2 } from '@lucide/vue'
import { onKeyStroke, useLocalStorage, useMediaQuery } from '@vueuse/core'
import { isActive, NAV_MAIN, NAV_SETTINGS } from '~/lib/nav'
import { ko } from '~/locales/ko'

const theme = useTheme()
const cycleTheme = () => theme.set(({ light: 'dark', dark: 'system', system: 'light' } as const)[theme.theme.value])
// 앱 셸: docs/design/ui-system.md 6절. 사이드바는 Ink Navy, 선택한 메뉴는 코랄 + Ink Navy 글자
const auth = useAuthStore()
const { ratio, level } = useUsage()
const route = useRoute()
const stored = useLocalStorage('toonflow:sidebarCollapsed', false)
// 좁은 화면에서는 사이드바를 서랍으로 띄우고, 접힘 설정은 넓은 화면에서만 쓴다
const mobile = useMediaQuery('(max-width: 767px)')
const drawer = ref(false)
const collapsed = computed({ get: () => stored.value && !mobile.value, set: (v) => { if (mobile.value) drawer.value = false; else stored.value = v } })
watch(() => route.fullPath, () => { drawer.value = false })

const paletteOpen = ref(false)
const feedbackOpen = ref(false)
onKeyStroke(['k', 'K'], (e) => {
  if (!(e.metaKey || e.ctrlKey)) return
  e.preventDefault()
  paletteOpen.value = !paletteOpen.value
})
const current = computed(() => [...NAV_MAIN, NAV_SETTINGS].find(i => isActive(i, route.path)))

async function signOut() {
  await auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <div class="flex min-h-svh">
    <div v-if="drawer" class="fixed inset-0 z-30 bg-black/40 md:hidden" aria-hidden="true" @click="drawer = false" />
    <aside
      class="bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-40 flex h-svh shrink-0 flex-col gap-1 overflow-y-auto p-3 transition-[width,translate] md:sticky md:top-0 md:translate-x-0"
      :class="[collapsed ? 'w-16' : 'w-60', drawer ? 'translate-x-0' : '-translate-x-full']"
    >
      <div class="flex items-center justify-between px-2 py-2">
        <span v-if="!collapsed" class="text-lg font-bold tracking-wide">{{ ko.brand.name }}</span>
        <button
          type="button"
          class="hover:bg-sidebar-accent rounded-md p-1.5"
          :aria-label="collapsed ? ko.nav.expand : ko.nav.collapse"
          @click="collapsed = !collapsed"
        >
          <PanelLeft class="size-4" />
        </button>
      </div>
      <AppWorkspaceSwitcher :collapsed="collapsed" />
      <AppSeriesSwitcher :collapsed="collapsed" />
      <nav class="flex flex-col gap-0.5">
        <NuxtLink
          v-for="item in NAV_MAIN"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-md px-3 py-2 text-sm"
          :class="isActive(item, route.path) ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold' : 'hover:bg-sidebar-accent'"
          :title="collapsed ? `${item.label} · ${item.ko}` : undefined"
        >
          <component :is="item.icon" class="size-4 shrink-0" aria-hidden="true" />
          <span v-if="!collapsed">{{ item.label }} <span class="text-xs opacity-70">{{ item.ko }}</span></span>
        </NuxtLink>
      </nav>
      <div class="mt-auto flex flex-col gap-0.5">
        <div v-if="!collapsed" class="px-3 py-2 text-xs opacity-70">
          {{ ko.nav.usage }}
          <div class="bg-sidebar-accent mt-1 h-1.5 overflow-hidden rounded-full">
            <div class="h-full rounded-full" :class="level === 'ok' ? 'bg-sidebar-primary' : level === 'warn' ? 'bg-warning' : 'bg-destructive'" :style="{ width: `${Math.min(100, ratio * 100)}%` }" />
          </div>
        </div>
        <NuxtLink to="/feedback" class="flex items-center gap-3 rounded-md px-3 py-2 text-sm" :class="route.path.startsWith('/feedback') ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold' : 'hover:bg-sidebar-accent'">
          <MessageSquare class="size-4 shrink-0" aria-hidden="true" />
          <span v-if="!collapsed">Feedback <span class="text-xs opacity-70">피드백</span></span>
        </NuxtLink>
        <NuxtLink to="/trash" class="flex items-center gap-3 rounded-md px-3 py-2 text-sm" :class="route.path.startsWith('/trash') ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold' : 'hover:bg-sidebar-accent'">
          <Trash2 class="size-4 shrink-0" aria-hidden="true" />
          <span v-if="!collapsed">Trash <span class="text-xs opacity-70">휴지통</span></span>
        </NuxtLink>
        <NuxtLink
          :to="NAV_SETTINGS.to"
          class="flex items-center gap-3 rounded-md px-3 py-2 text-sm"
          :class="isActive(NAV_SETTINGS, route.path) ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold' : 'hover:bg-sidebar-accent'"
        >
          <component :is="NAV_SETTINGS.icon" class="size-4 shrink-0" aria-hidden="true" />
          <span v-if="!collapsed">{{ NAV_SETTINGS.label }} <span class="text-xs opacity-70">{{ NAV_SETTINGS.ko }}</span></span>
        </NuxtLink>
        <button type="button" class="hover:bg-sidebar-accent flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm" @click="signOut">
          <LogOut class="size-4 shrink-0" aria-hidden="true" />
          <span v-if="!collapsed">{{ ko.nav.signOut }}</span>
        </button>
      </div>
    </aside>
    <div class="flex min-w-0 flex-1 flex-col">
      <header class="bg-background/90 sticky top-0 z-10 flex h-14 items-center gap-2 border-b px-3 backdrop-blur md:gap-3 md:px-6">
        <Button variant="ghost" size="icon" class="md:hidden" :aria-label="ko.nav.menu" @click="drawer = true">
          <Menu class="size-4" />
        </Button>
        <p class="truncate text-sm font-medium">
          {{ current?.label }} <span class="text-muted-foreground">· {{ current?.ko }}</span>
        </p>
        <div class="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" :aria-label="ko.nav.search" :title="ko.palette.shortcut" @click="paletteOpen = true">
            <Search class="size-4" />
          </Button>
          <Button variant="ghost" size="icon" :aria-label="ko.nav.queue" disabled>
            <ListTodo class="size-4" />
          </Button>
          <Button variant="ghost" size="icon" :aria-label="ko.feedback.send" :title="ko.feedback.send" @click="feedbackOpen = true">
            <MessageSquarePlus class="size-4" />
          </Button>
          <AppNotifications />
          <Button variant="ghost" size="icon" :aria-label="ko.theme[theme.theme.value]" :title="ko.theme[theme.theme.value]" @click="cycleTheme">
            <Sun v-if="theme.theme.value === 'light'" class="size-4" />
            <Moon v-else-if="theme.theme.value === 'dark'" class="size-4" />
            <Monitor v-else class="size-4" />
          </Button>
        </div>
      </header>
      <main class="min-w-0 flex-1">
        <div v-if="auth.workspace?.deleteAt" class="bg-destructive/10 text-destructive flex flex-wrap items-center gap-3 px-4 py-2 text-sm" role="alert">
          {{ ko.workspaces.banner(new Date(auth.workspace.deleteAt).toLocaleDateString('ko-KR')) }}
          <Button v-if="auth.role === 'owner'" size="sm" variant="outline" @click="auth.restoreWorkspace()">
            {{ ko.workspaces.restore }}
          </Button>
        </div>
        <slot />
      </main>
      <AppCommandPalette v-if="paletteOpen" @close="paletteOpen = false" />
      <AppFeedbackDialog v-model:open="feedbackOpen" />
    </div>
  </div>
</template>
