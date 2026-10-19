<script setup lang="ts">
import type { Crop } from '#shared/studio'
import { candidatePath, cropStyle } from '#shared/illustrate'

// 컷 그림 (ILL-11·23). 위치는 부모가 정한다 (absolute/relative)
const props = defineProps<{ candidateId: string, crop?: Crop | null }>()
const auth = useAuthStore()
const path = computed(() => (auth.workspace ? candidatePath(auth.workspace.id, props.candidateId) : null))
</script>

<template>
  <div class="overflow-hidden">
    <AppStorageImg :path="path" :style="cropStyle(crop)" />
  </div>
</template>
