<script setup lang="ts">
import type { Adjust } from '#shared/studio'
import type { Crop } from '#shared/studio'
import { cropStyle } from '#shared/illustrate'
import { adjustFilter } from '#shared/render'
import { resolveCandidatePath } from '~/lib/candidates'

// 컷 그림 (ILL-11·23). 위치는 부모가 정한다 (absolute/relative)
const props = defineProps<{ candidateId: string, panelId: string, crop?: Crop | null, adjust?: Adjust | null }>()
const auth = useAuthStore()
const route = useRoute()
const { $firestore } = useNuxtApp()
const path = ref<string | null>(null)
watch(() => [auth.workspace?.id, props.candidateId, props.panelId] as const, async ([ws, id, panelId]) => {
  path.value = null
  if (!ws) return
  const p = await resolveCandidatePath($firestore, ws, String(route.query.episode ?? ''), { id, panelId }).catch(() => null)
  if (id === props.candidateId) path.value = p
}, { immediate: true })
</script>

<template>
  <div class="overflow-hidden">
    <AppStorageImg :path="path" :style="{ ...cropStyle(crop), filter: adjustFilter(adjust) }" />
  </div>
</template>
