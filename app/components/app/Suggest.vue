<script setup lang="ts">
import { Loader2, Sparkles } from '@lucide/vue'
import { ko } from '~/locales/ko'

// 추천 입력: 칩을 누르면 칸에 넣고, 넣은 뒤에도 직접 고칠 수 있다. ai면 AI 추천 버튼도 같이
defineProps<{ label: string, items: readonly string[], ai?: boolean, loading?: boolean, disabled?: boolean }>()
const emit = defineEmits<{ ask: [], pick: [value: string] }>()
const t = ko.suggest
</script>

<template>
  <div v-if="ai || items.length" class="flex flex-wrap items-center gap-1" role="group" :aria-label="t.group(label)">
    <button
      v-if="ai" type="button" class="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs disabled:opacity-50"
      :disabled="disabled || loading" :aria-busy="loading || undefined" :aria-label="t.ask(label)" @click="emit('ask')"
    >
      <Loader2 v-if="loading" class="size-3 animate-spin" /><Sparkles v-else class="size-3" />
      {{ loading ? t.asking : t.ai }}
    </button>
    <button
      v-for="it in items" :key="it" type="button" class="bg-muted hover:bg-muted/60 max-w-full truncate rounded-full px-2 py-0.5 text-left text-xs disabled:opacity-50"
      :disabled="disabled" :title="it" @click="emit('pick', it)"
    >
      {{ it }}
    </button>
  </div>
</template>
