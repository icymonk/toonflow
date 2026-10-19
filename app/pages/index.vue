<script setup lang="ts">
import { ko } from '~/locales/ko'

const auth = useAuthStore()
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col items-start gap-4 p-8">
    <p class="text-muted-foreground text-sm">
      {{ ko.home.welcome(auth.workspace?.name ?? '') }}
    </p>
    <h1 class="text-3xl font-bold">
      {{ ko.brand.slogan }}
    </h1>
    <p class="text-muted-foreground">
      {{ ko.brand.message }}
    </p>
    <Button disabled>
      {{ ko.home.start }}
    </Button>
  </div>
</template>
