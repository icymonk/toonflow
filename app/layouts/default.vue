<script setup lang="ts">
import { ko } from '~/locales/ko'

// 사이드바·위쪽 바 전체는 0-5 앱 셸에서 (docs/design/ui-system.md 6절)
const auth = useAuthStore()

async function signOut() {
  await auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <div class="flex min-h-svh">
    <aside class="bg-sidebar text-sidebar-foreground flex w-56 shrink-0 flex-col gap-1 p-3">
      <p class="px-3 py-2 text-lg font-bold tracking-wide">
        {{ ko.brand.name }}
      </p>
      <p class="truncate px-3 pb-3 text-xs opacity-70">
        {{ auth.workspace?.name }}
      </p>
      <NuxtLink to="/" class="hover:bg-sidebar-accent rounded-md px-3 py-2 text-sm" active-class="!bg-sidebar-primary !text-sidebar-primary-foreground font-semibold" exact-active-class="">
        {{ ko.nav.home }}
      </NuxtLink>
      <NuxtLink to="/settings" class="hover:bg-sidebar-accent rounded-md px-3 py-2 text-sm" active-class="!bg-sidebar-primary !text-sidebar-primary-foreground font-semibold">
        {{ ko.nav.settings }}
      </NuxtLink>
      <div class="mt-auto">
        <button type="button" class="hover:bg-sidebar-accent w-full rounded-md px-3 py-2 text-left text-sm" @click="signOut">
          {{ ko.nav.signOut }}
        </button>
      </div>
    </aside>
    <main class="min-w-0 flex-1">
      <slot />
    </main>
  </div>
</template>
