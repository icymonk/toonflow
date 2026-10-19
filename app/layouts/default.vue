<script setup lang="ts">
import { ListTodo, LogOut, PanelLeft, Search, Trash2 } from '@lucide/vue'
import { onKeyStroke, useLocalStorage } from '@vueuse/core'
import { isActive, NAV_MAIN, NAV_SETTINGS } from '~/lib/nav'
import { ko } from '~/locales/ko'

// 앱 셸: docs/design/ui-system.md 6절. 사이드바는 Ink Navy, 선택한 메뉴는 코랄 + Ink Navy 글자
const auth = useAuthStore()
const { ratio, level } = useUsage()
const route = useRoute()
const collapsed = useLocalStorage('toonflow:sidebarCollapsed', false)

const paletteOpen = ref(false)
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
    <aside
      class="bg-sidebar text-sidebar-foreground sticky top-0 flex h-svh shrink-0 flex-col gap-1 p-3 transition-[width]"
      :class="collapsed ? 'w-16' : 'w-60'"
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
      <p v-if="!collapsed" class="truncate px-3 pb-3 text-xs opacity-70">
        {{ auth.workspace?.name }}
      </p>
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
      <header class="bg-background/90 sticky top-0 z-10 flex h-14 items-center gap-3 border-b px-6 backdrop-blur">
        <p class="text-sm font-medium">
          {{ current?.label }} <span class="text-muted-foreground">· {{ current?.ko }}</span>
        </p>
        <div class="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" :aria-label="ko.nav.search" :title="ko.palette.shortcut" @click="paletteOpen = true">
            <Search class="size-4" />
          </Button>
          <Button variant="ghost" size="icon" :aria-label="ko.nav.queue" disabled>
            <ListTodo class="size-4" />
          </Button>
          <AppNotifications />
        </div>
      </header>
      <main class="min-w-0 flex-1">
        <slot />
      </main>
      <AppCommandPalette v-if="paletteOpen" @close="paletteOpen = false" />
    </div>
  </div>
</template>
