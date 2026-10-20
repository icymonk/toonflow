<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Checkbox } from '@/components/ui/checkbox'

// 기본 체크박스처럼 v-model에 boolean, 또는 배열 + value(체크하면 넣고 풀면 뺀다)
const props = defineProps<{ modelValue?: boolean | unknown[] | null, value?: unknown, disabled?: boolean, class?: HTMLAttributes['class'] }>()
const emit = defineEmits<{ 'update:modelValue': [value: any], 'change': [checked: boolean] }>()
const on = () => Array.isArray(props.modelValue) ? props.modelValue.includes(props.value) : !!props.modelValue
function set(v: boolean | 'indeterminate') {
  const c = v === true
  const m = props.modelValue
  emit('update:modelValue', Array.isArray(m) ? (c ? [...m, props.value] : m.filter(x => x !== props.value)) : c)
  emit('change', c)
}
</script>

<template>
  <Checkbox :model-value="on()" :disabled="disabled" :class="props.class" @update:model-value="set" />
</template>
