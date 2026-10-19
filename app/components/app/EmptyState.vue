<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{ icon: Component, title: string, body: string }>()
</script>

<template>
  <div class="text-muted-foreground mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
    <component :is="icon" class="size-10 opacity-60" aria-hidden="true" />
    <h2 class="text-foreground text-lg font-semibold">
      {{ title }}
    </h2>
    <p class="text-sm">
      {{ body }}
    </p>
    <slot />
  </div>
</template>
