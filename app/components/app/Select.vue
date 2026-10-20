<script setup lang="ts">
import type { HTMLAttributes, VNode } from 'vue'
import { Fragment } from 'vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// 기본 <select>처럼 <option>을 그대로 넣어 쓰는 shadcn Select. 값은 문자열이 아니어도 된다(숫자·''·undefined)
defineOptions({ inheritAttrs: false })
const props = defineProps<{ modelValue?: unknown, value?: unknown, disabled?: boolean, class?: HTMLAttributes['class'] }>()
const emit = defineEmits<{ 'update:modelValue': [value: any], 'change': [value: any] }>()
const slots = defineSlots<{ default?: () => VNode[] }>()

interface Opt { value: unknown, label: string, disabled: boolean }
const flat = (ns: VNode[]): VNode[] => ns.flatMap(n => n.type === Fragment ? flat(n.children as VNode[]) : [n])
const text = (c: unknown): string => typeof c === 'string' ? c : Array.isArray(c) ? c.map(x => text(typeof x === 'object' && x ? (x as VNode).children : x)).join('') : ''
function options(): Opt[] {
  return flat(slots.default?.() ?? []).filter(n => n.type === 'option').map((n) => {
    const p = (n.props ?? {}) as Record<string, unknown>
    const label = text(n.children).trim()
    return { value: 'value' in p ? p.value : label, label, disabled: p.disabled != null && p.disabled !== false }
  })
}
// v-model 또는 :value(+@change) 둘 다 받는다
const current = () => props.modelValue !== undefined ? props.modelValue : props.value
const same = (a: unknown, b: unknown) => Object.is(a, b) || String(a ?? '') === String(b ?? '')
const index = (os: Opt[]) => {
  const i = os.findIndex(o => same(o.value, current()))
  return i < 0 ? undefined : String(i)
}
function pick(os: Opt[], i: unknown) {
  const o = os[Number(i)]
  if (!o) return
  emit('update:modelValue', o.value)
  emit('change', o.value)
}
</script>

<template>
  <Select v-for="os in [options()]" :key="0" :model-value="index(os)" :disabled="disabled" @update:model-value="i => pick(os, i)">
    <SelectTrigger v-bind="$attrs" :class="props.class" :data-value="String(current() ?? '')">
      <SelectValue>{{ os[Number(index(os))]?.label ?? '' }}</SelectValue>
    </SelectTrigger>
    <SelectContent>
      <SelectItem v-for="(o, i) in os" :key="i" :value="String(i)" :disabled="o.disabled" :data-value="String(o.value ?? '')">
        {{ o.label }}
      </SelectItem>
    </SelectContent>
  </Select>
</template>
