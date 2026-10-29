<script setup lang="ts">
// QCK-10 질문 카드 선택지: 큰 카드, 고른 것은 강조 테두리 (잘리지 않게 ring 대신 border + shadow)
defineProps<{ selected?: boolean, label: string, sub?: string, row?: boolean }>()
defineEmits<{ pick: [] }>()
</script>

<template>
  <button
    type="button"
    class="bg-card flex min-h-14 w-full rounded-xl border-2 p-2.5 text-left transition-colors active:scale-[0.99]"
    :class="[selected ? 'border-primary shadow-[0_0_0_3px] shadow-primary/20' : 'hover:border-muted-foreground/30', row ? 'items-center gap-3' : 'flex-col gap-1.5']"
    :aria-pressed="selected"
    @click="$emit('pick')"
  >
    <div v-if="$slots.default" class="bg-muted flex shrink-0 items-center justify-center overflow-hidden rounded-lg" :class="row ? 'size-20' : 'h-24 w-full'">
      <slot />
    </div>
    <div class="flex min-w-0 flex-col">
      <span class="text-sm font-semibold">{{ label }}</span>
      <span v-if="sub" class="text-muted-foreground text-xs">{{ sub }}</span>
    </div>
  </button>
</template>
