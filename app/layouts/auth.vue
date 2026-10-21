<script setup lang="ts">
import { ko } from '~/locales/ko'
</script>

<template>
  <div class="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
    <AppBrandLogo />
    <div class="w-full max-w-sm">
      <slot />
    </div>
    <nav class="text-muted-foreground flex gap-4 text-xs">
      <NuxtLink to="/terms" class="underline">{{ ko.legal.terms }}</NuxtLink>
      <NuxtLink to="/privacy" class="underline">{{ ko.legal.privacy }}</NuxtLink>
    </nav>
  </div>
</template>
