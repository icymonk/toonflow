<script setup lang="ts">
import type { StoryVersion } from '#shared/story'
import { Loader2, Sparkles } from '@lucide/vue'
import { ko } from '~/locales/ko'

// STO-11·12·21: 왼쪽 각색안 목록 + 만들기
defineProps<{ versions: StoryVersion[], activeId: string | null, selectedId: string, edit: boolean, running: number, hasMaterial: boolean }>()
const emit = defineEmits<{ select: [id: string], make: [n: number, request: string] }>()
const t = ko.studio.story
const n = ref(1)
const request = ref('')
const time = (v: StoryVersion) => (v.createdAt ? new Date(v.createdAt.toMillis()).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')
function make() {
  emit('make', n.value, request.value.trim())
  request.value = ''
}
</script>

<template>
  <div class="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
    <p v-if="!versions.length && !running" class="text-muted-foreground px-1 text-sm">
      {{ t.empty }}
    </p>
    <button
      v-for="v in versions" :key="v.id" class="flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-sm"
      :class="v.id === selectedId ? 'bg-primary/15 ring-primary ring-1' : 'hover:bg-muted'" @click="emit('select', v.id)"
    >
      <span class="flex items-center gap-1.5 font-medium">
        {{ v.label }}
        <span class="bg-muted rounded px-1 text-[10px]">{{ v.editedAt ? t.edited : v.source === 'ai' ? t.ai : t.edited }}</span>
        <span v-if="v.id === activeId" class="bg-primary text-primary-foreground rounded px-1 text-[10px]">{{ t.active }}</span>
      </span>
      <span class="text-muted-foreground line-clamp-1 text-xs">{{ v.logline }}</span>
      <span class="text-muted-foreground text-[10px]">{{ time(v) }} · {{ ko.stories.tones[v.settings.tone] }} · {{ ko.studio.page(v.settings.pageCount) }}</span>
    </button>
    <p v-if="running" class="text-muted-foreground flex items-center gap-1.5 px-1 text-xs">
      <Loader2 class="size-3.5 animate-spin" /> {{ t.making(running) }}
    </p>
    <div v-if="edit" class="mt-2 flex flex-col gap-1.5 border-t pt-2">
      <Input v-model="request" :placeholder="t.requestPh" :aria-label="t.request" maxlength="200" />
      <div class="flex gap-1.5">
        <AppSelect v-model.number="n" class="border-input bg-card h-9 rounded-md border px-2 text-sm" :aria-label="t.count">
          <option v-for="i in 3" :key="i" :value="i">
            {{ i }}안
          </option>
        </AppSelect>
        <Button class="flex-1" size="sm" :disabled="!hasMaterial" :title="hasMaterial ? '' : t.noMaterial" @click="make">
          <Sparkles class="size-4" /> {{ t.make }}
        </Button>
      </div>
    </div>
  </div>
</template>
