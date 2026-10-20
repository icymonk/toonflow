<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
import { cn } from '@/lib/utils'

// 기본 range 입력 대신. input은 끄는 동안, change는 손을 뗄 때
defineOptions({ inheritAttrs: false })
const props = defineProps<{ modelValue: number, min?: number | string, max?: number | string, step?: number | string, disabled?: boolean, class?: HTMLAttributes['class'] }>()
const emit = defineEmits<{ 'update:modelValue': [value: number], 'input': [value: number], 'change': [value: number] }>()
function move(v?: number[]) {
  const n = v?.[0]
  if (n == null) return
  emit('update:modelValue', n)
  emit('input', n)
}
</script>

<template>
  <SliderRoot
    :model-value="[modelValue]" :min="Number(min ?? 0)" :max="Number(max ?? 100)" :step="Number(step ?? 1)" :disabled="disabled"
    :class="cn('relative flex h-4 w-full touch-none items-center select-none data-disabled:opacity-50', props.class)"
    @update:model-value="move" @value-commit="v => v[0] != null && emit('change', v[0])"
  >
    <SliderTrack class="bg-muted relative h-1 grow overflow-hidden rounded-full">
      <SliderRange class="bg-primary absolute h-full" />
    </SliderTrack>
    <SliderThumb v-bind="$attrs" class="border-ring ring-ring/50 block size-3.5 rounded-full border bg-white transition-[color,box-shadow] hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden" />
  </SliderRoot>
</template>
