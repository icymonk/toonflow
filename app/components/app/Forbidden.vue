<script setup lang="ts">
import { ko } from '~/locales/ko'

const t = ko.forbidden
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-24 text-center" role="alert">
    <p class="text-muted-foreground text-5xl font-bold tabular-nums">
      403
    </p>
    <h1 class="text-xl font-semibold">
      {{ t.title }}
    </h1>
    <p class="text-muted-foreground text-sm">
      {{ t.body }}
    </p>
    <Button as-child>
      <NuxtLink to="/">
        {{ t.home }}
      </NuxtLink>
    </Button>
  </div>
</template>
