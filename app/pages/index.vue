<script setup lang="ts">
import { ko } from '~/locales/ko'
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-4 p-8">
    <p class="text-sm font-semibold tracking-wide text-muted-foreground">{{ ko.brand.name }}</p>
    <h1 class="text-3xl font-bold">{{ ko.brand.slogan }}</h1>
    <p class="text-muted-foreground">{{ ko.brand.message }}</p>
    <Button>{{ ko.home.start }}</Button>
  </main>
</template>
