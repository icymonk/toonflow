<script setup lang="ts">
import type { Episode } from '#shared/episodes'
import { ko } from '~/locales/ko'

// PUB-21 발행 목록
const t = ko.publishList
const { episodes, series } = useStories()
const filter = ref('')
const at = (e: Episode) => e.published?.at?.toMillis() ?? 0
const rows = computed(() => episodes.value.filter(e => e.status === 'published' && (!filter.value || e.seriesId === filter.value)).sort((a, b) => at(b) - at(a)))
const name = (id: string) => series.value.find(s => s.id === id)?.name ?? ''
const date = (e: Episode) => (at(e) ? new Date(at(e)).toLocaleDateString('ko-KR') : '')
const krw = (n: number) => `₩${(n ?? 0).toLocaleString('ko-KR')}`
</script>

<template>
  <div class="flex flex-col gap-4 p-8">
    <div class="flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold">
        Publish <span class="text-muted-foreground text-base font-normal">· 발행</span>
      </h1>
      <AppSelect v-model="filter" class="border-input bg-card h-9 rounded-md border px-2 text-sm" :aria-label="t.series">
        <option value="">{{ t.allSeries }}</option>
        <option v-for="s in series" :key="s.id" :value="s.id">{{ s.name }}</option>
      </AppSelect>
    </div>
    <p v-if="!rows.length" class="text-muted-foreground text-sm">{{ t.empty }}</p>
    <table v-else class="w-full text-sm">
      <thead class="text-muted-foreground text-left text-xs">
        <tr><th class="py-2">{{ t.col.date }}</th><th>{{ t.col.series }}</th><th>{{ t.col.title }}</th><th>{{ t.col.link }}</th><th>{{ t.col.subs }}</th><th>{{ t.col.cost }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="e in rows" :key="e.id" class="border-t">
          <td class="py-2">{{ date(e) }}</td>
          <td>{{ name(e.seriesId) }}</td>
          <td><NuxtLink :to="{ path: '/studio', query: { episode: e.id, step: 'export' } }" class="font-medium hover:underline">{{ e.title }}</NuxtLink></td>
          <td class="max-w-64 truncate"><a v-if="e.published?.url" :href="e.published.url" target="_blank" rel="noopener" class="text-primary underline">{{ e.published.url }}</a></td>
          <td>{{ e.submissionIds.length }}</td>
          <td>{{ krw(e.costKrw) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
