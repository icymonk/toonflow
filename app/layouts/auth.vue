<script setup lang="ts">
import { ko } from '~/locales/ko'
</script>

<template>
  <div class="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
    <p class="text-lg font-bold tracking-wide">
      {{ ko.brand.name }}
    </p>
    <div class="w-full max-w-sm">
      <slot />
    </div>
  </div>
</template>
