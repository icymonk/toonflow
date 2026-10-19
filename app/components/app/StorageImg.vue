<script setup lang="ts">
import { getDownloadURL, ref as storageRef } from 'firebase/storage'

const props = defineProps<{ path?: string | null, alt?: string }>()
const { $storage } = useNuxtApp()
const cache = useState<Record<string, string>>('storage-urls', () => ({}))
const url = ref('')
watch(() => props.path, async (p) => {
  url.value = ''
  if (!p) return
  url.value = cache.value[p] ??= await getDownloadURL(storageRef($storage, p)).catch(() => '')
}, { immediate: true })
</script>

<template>
  <img v-if="url" :src="url" :alt="alt ?? ''" class="object-cover" loading="lazy">
  <div v-else class="bg-muted" />
</template>
