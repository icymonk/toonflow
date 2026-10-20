<script setup lang="ts">
import { ko } from '~/locales/ko'

withDefaults(defineProps<{ rows?: number }>(), { rows: 4 })
</script>

<template>
  <div class="flex flex-col gap-3 py-2" role="status" :aria-label="ko.dialog.loading">
    <Skeleton v-for="i in rows" :key="i" class="h-14 w-full" />
  </div>
</template>
