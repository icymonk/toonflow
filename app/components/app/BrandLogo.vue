<script setup lang="ts">
import { ko } from '~/locales/ko'

// 로고: docs/design/brand.md 4절. Flow Panels 심볼(이어진 컷 + 말풍선 컷) + TOONFLOW 워드마크
const props = withDefaults(defineProps<{
  /** onDark: 어두운 배경(사이드바)용 — 바탕 사각형 없이 크림색 컷 + 코랄 말풍선 */
  onDark?: boolean
  symbolOnly?: boolean
  size?: 'sm' | 'md'
}>(), { onDark: false, symbolOnly: false, size: 'md' })

const box = computed(() => props.size === 'sm' ? 'size-5' : 'size-7')
const text = computed(() => props.size === 'sm' ? 'text-sm' : 'text-lg')
</script>

<template>
  <span class="inline-flex items-center gap-2" role="img" :aria-label="ko.brand.name">
    <svg v-if="onDark" :class="box" class="shrink-0" viewBox="7 8 50 53" aria-hidden="true">
      <rect x="9" y="10" width="27" height="24" rx="5" fill="#fff6ef" />
      <path d="M28 29h22a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H36l-8 6v-6a5 5 0 0 1-5-5V34a5 5 0 0 1 5-5z" fill="#ff735c" />
    </svg>
    <svg v-else :class="box" class="shrink-0" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#202538" />
      <rect x="9" y="10" width="27" height="24" rx="5" fill="#fff6ef" />
      <path d="M28 29h22a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H36l-8 6v-6a5 5 0 0 1-5-5V34a5 5 0 0 1 5-5z" fill="#ff735c" />
    </svg>
    <span v-if="!symbolOnly" :class="text" class="font-extrabold tracking-wide" aria-hidden="true">TOON<span class="text-primary">FLOW</span></span>
  </span>
</template>
