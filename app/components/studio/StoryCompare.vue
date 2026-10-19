<script setup lang="ts">
import type { StoryVersion } from '#shared/story'
import { sceneDiff } from '#shared/story'
import { ko } from '~/locales/ko'

// STO-23
const props = defineProps<{ a: StoryVersion, b: StoryVersion }>()
const emit = defineEmits<{ close: [] }>()
const t = ko.studio.story
const rows = computed(() => sceneDiff(props.a, props.b))
const hl = (c: boolean) => (c ? 'rounded bg-amber-100 px-0.5 text-amber-950' : '')
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-3">
    <div class="flex items-center gap-2">
      <h2 class="text-lg font-semibold">{{ t.compare }} · {{ a.label }} ↔ {{ b.label }}</h2>
      <span class="rounded bg-amber-100 px-1 text-xs text-amber-950">{{ t.changed }}</span>
      <Button size="sm" variant="outline" class="ml-auto" @click="emit('close')">{{ t.closeCompare }}</Button>
    </div>
    <div class="grid grid-cols-2 gap-3 text-sm">
      <template v-for="(r, i) in rows" :key="i">
        <Card v-for="(side, k) in [r.a, r.b]" :key="k" class="gap-1 py-3">
          <CardContent class="flex flex-col gap-1 px-4">
            <template v-if="side">
              <span class="text-muted-foreground text-xs">{{ t.scene(i + 1) }}</span>
              <span class="font-medium" :class="hl(side.headingChanged)">{{ side.heading }}</span>
              <p :class="hl(side.beatsChanged)">{{ side.beats }}</p>
              <p v-for="(l, j) in side.lines" :key="j" class="font-mono text-xs" :class="hl(l.changed)">{{ l.text }}</p>
            </template>
            <span v-else class="text-muted-foreground text-xs">—</span>
          </CardContent>
        </Card>
      </template>
    </div>
  </div>
</template>
