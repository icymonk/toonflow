<script setup lang="ts">
import { ko } from '~/locales/ko'

// SBD-17 이번 화 등장인물표: 콘티 AI가 만든 인물별 외형. 모든 컷 그림 프롬프트에 들어간다
const props = defineProps<{ cast: { name: string, look: string }[], edit: boolean, saved: string[] }>()
const emit = defineEmits<{ save: [cast: { name: string, look: string }[]], saveCharacter: [name: string, look: string] }>()
const t = ko.studio.look
const save = (i: number, look: string) => emit('save', props.cast.map((c, j) => (j === i ? { ...c, look: look.trim().slice(0, 400) } : c)))
</script>

<template>
  <div class="flex flex-col gap-1.5 px-1 pt-2">
    <span class="text-xs font-semibold">{{ t.castTitle }}</span>
    <p class="text-muted-foreground text-xs">{{ t.castHint }}</p>
    <label v-for="(c, i) in cast" :key="c.name" class="flex flex-col gap-0.5">
      <span class="flex items-center justify-between text-xs font-medium">{{ c.name }}
        <span v-if="saved.includes(c.name)" class="text-muted-foreground font-normal">{{ t.castSaved }}</span>
        <Button v-else-if="edit" size="sm" variant="ghost" class="h-7 px-2 text-xs" @click.prevent="emit('saveCharacter', c.name, c.look)">{{ t.castSave }}</Button>
      </span>
      <Textarea :model-value="c.look" rows="2" class="text-xs" maxlength="400" :disabled="!edit" :aria-label="c.name" @change="(e: Event) => save(i, (e.target as HTMLTextAreaElement).value)" />
    </label>
  </div>
</template>
