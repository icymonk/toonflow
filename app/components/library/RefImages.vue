<script setup lang="ts">
import { ImagePlus, Star, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { ko } from '~/locales/ko'

// CHR-04·STL-02 참조 이미지 (최대 5장)
const props = defineProps<{ paths: string[], cover?: string | null, edit: boolean, locked?: boolean }>()
const emit = defineEmits<{ upload: [file: File], remove: [path: string], cover: [path: string] }>()
const t = ko.library
const input = ref<HTMLInputElement | null>(null)
function pick(e: Event) {
  const files = [...((e.target as HTMLInputElement).files ?? [])].slice(0, 5 - props.paths.length)
  files.forEach(f => (f.size > 10 * 1024 * 1024 ? toast.error(t.tooBig) : emit('upload', f)))
  ;(e.target as HTMLInputElement).value = ''
}
</script>

<template>
  <div class="grid grid-cols-3 gap-2">
    <div v-for="p in paths" :key="p" class="group relative aspect-square overflow-hidden rounded-md border" :class="{ 'ring-primary ring-2': cover === p }">
      <AppStorageImg :path="p" class="size-full" />
      <div v-if="edit" class="absolute inset-x-0 top-0 flex justify-between p-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
        <button v-if="cover !== undefined" class="bg-card rounded p-0.5" :aria-label="t.setCover" :title="t.setCover" @click="emit('cover', p)"><Star class="size-3.5" /></button>
        <button class="bg-card ml-auto rounded p-0.5" :aria-label="t.removeImage" @click="emit('remove', p)"><X class="size-3.5" /></button>
      </div>
    </div>
    <button
      v-if="edit && paths.length < 5" class="text-muted-foreground flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs disabled:opacity-50"
      :disabled="locked" @click="input?.click()"
    >
      <ImagePlus class="size-5" /> {{ t.upload }}
    </button>
    <input ref="input" type="file" accept="image/png,image/jpeg,image/webp" multiple class="hidden" @change="pick">
  </div>
</template>
