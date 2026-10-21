<script setup lang="ts">
import type { DesignInfo, PageDesign } from '#shared/pagedesign'
import type { Typeset } from '#shared/render'
import { getDownloadURL, ref as storageRef } from 'firebase/storage'
import { layoutDesign } from '#shared/pagedesign'
import { fontCss, pageSize } from '#shared/render'

// PUB-15·16 표지·끝장 미리 보기. 출력(app/lib/export.ts paintDesign)과 같은 배치
const props = defineProps<{ design: PageDesign, info: DesignInfo, aspect?: string, typeset: Typeset, label?: string | null, watermark?: string | null }>()
const { $storage } = useNuxtApp()
const cache = useState<Record<string, string>>('storage-urls', () => ({}))
const size = computed(() => pageSize(props.aspect))
const laid = computed(() => layoutDesign(props.design, props.info, size.value.w, size.value.h))
const url = ref('')
watch(() => props.design.imagePath, async (p) => {
  url.value = ''
  if (p) url.value = cache.value[p] ??= await getDownloadURL(storageRef($storage, p)).catch(() => '')
}, { immediate: true })
</script>

<template>
  <svg :viewBox="`0 0 ${size.w} ${size.h}`" xmlns="http://www.w3.org/2000/svg" class="block h-auto">
    <rect :width="size.w" :height="size.h" :fill="design.bgColor" />
    <image v-if="url" :href="url" :width="size.w" :height="size.h" preserveAspectRatio="xMidYMid slice" />
    <rect v-if="laid.box" :x="laid.box.x" :y="laid.box.y" :width="laid.box.w" :height="laid.box.h" rx="24" :fill="design.bgColor" fill-opacity="0.85" />
    <text
      v-for="(l, i) in laid.lines" :key="i" :x="size.w / 2" :y="l.y" text-anchor="middle" dominant-baseline="central"
      :font-size="l.size" :font-weight="l.bold ? 700 : 500" :fill="design.textColor" :font-family="fontCss(typeset.font)"
    >{{ l.text }}</text>
    <text v-if="label" :x="size.w - 24" :y="size.h - 4" text-anchor="end" font-size="18" fill="#71717A" font-family="Pretendard Variable, sans-serif">{{ label }}</text>
    <text v-if="watermark" x="24" :y="size.h - 4" font-size="18" fill="#71717A" font-family="Pretendard Variable, sans-serif">{{ watermark }}</text>
  </svg>
</template>
