<script setup lang="ts">
import type { QueueJob } from '~/composables/useJobQueue'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { episodeTitle } from '#shared/episodes'
import { dailyUsage, formatKrw, groupUsage, recentMonths } from '#shared/usage'
import { ko } from '~/locales/ko'

// AIU-21 사용 내역: 그 달 AI 작업을 일별·종류별·작품별·에피소드별·멤버별로
type UsageJob = QueueJob & { costKrw?: number, requestedBy?: string }
const t = ko.settings.usageDetail
const auth = useAuthStore()
const { $firestore } = useNuxtApp()
const { series, episodes } = useStories()
const months = recentMonths(6)
const month = ref(months[0]!)
const jobs = ref<UsageJob[]>([])
const names = ref<Record<string, string>>({})
const shown = ref(30)

let stops: (() => void)[] = []
watch([() => auth.workspace?.id, month], ([ws, m]) => {
  stops.forEach(f => f())
  stops = []
  jobs.value = []
  shown.value = 30
  if (!ws) return
  stops.push(onSnapshot(query(collection($firestore, 'workspaces', ws, 'aiJobs'), where('month', '==', m)), s => (jobs.value = s.docs.map(d => ({ id: d.id, ...d.data() }) as UsageJob)), () => {}))
  stops.push(onSnapshot(collection($firestore, 'workspaces', ws, 'members'), s => (names.value = Object.fromEntries(s.docs.map(d => [d.id, d.get('displayName') || d.get('email') || d.id]))), () => {}))
}, { immediate: true })
onScopeDispose(() => stops.forEach(f => f()))

const epOf = (id?: string) => (id ? episodes.value.find(e => e.id === id) : undefined)
const seriesName = (id?: string) => series.value.find(s => s.id === id)?.name ?? ''
const where_ = (epId?: string) => {
  const ep = epOf(epId)
  return ep ? [seriesName(ep.seriesId), episodeTitle(ep.title, ep.number)].filter(Boolean).join(' · ') : ''
}
const total = computed(() => jobs.value.reduce((n, j) => n + (j.costKrw ?? 0), 0))
const daily = computed(() => dailyUsage(jobs.value, month.value))
const peak = computed(() => Math.max(1, ...daily.value))
const groups = computed(() => [
  { title: t.byType, rows: groupUsage(jobs.value, j => j.type).map(g => ({ ...g, label: ko.notifications.types[g.key] ?? g.key })) },
  { title: t.bySeries, rows: groupUsage(jobs.value, j => epOf(j.target?.episodeId)?.seriesId).map(g => ({ ...g, label: seriesName(g.key) || t.noEpisode })) },
  { title: t.byEpisode, rows: groupUsage(jobs.value, j => j.target?.episodeId).map(g => ({ ...g, label: where_(g.key) || t.noEpisode })) },
  { title: t.byMember, rows: groupUsage(jobs.value, j => j.requestedBy).map(g => ({ ...g, label: names.value[g.key] ?? (g.key || t.none) })) },
])
const list = computed(() => [...jobs.value].sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)))
const clock = (j: UsageJob) => (j.createdAt ? new Date(j.createdAt.toMillis()).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')
</script>

<template>
  <Card data-testid="usage-detail">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{{ t.title }}</CardTitle>
        <AppSelect v-model="month" class="border-input bg-card h-8 rounded-lg border px-2.5 text-sm" :aria-label="t.month">
          <option v-for="m in months" :key="m" :value="m">
            {{ t.monthLabel(m) }}
          </option>
        </AppSelect>
      </div>
      <CardDescription>{{ t.hint }}</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-6">
      <p class="text-2xl font-semibold tabular-nums">
        {{ t.total(formatKrw(total), jobs.length) }}
      </p>
      <p v-if="!jobs.length" class="text-muted-foreground text-sm">
        {{ t.empty }}
      </p>
      <template v-else>
        <div>
          <p class="text-muted-foreground mb-2 text-xs font-medium">
            {{ t.daily }}
          </p>
          <div class="flex h-24 items-end gap-px">
            <div v-for="(krw, i) in daily" :key="i" class="flex h-full flex-1 flex-col justify-end" :title="t.dayTip(i + 1, formatKrw(krw))">
              <div class="bg-primary/80 min-h-px rounded-t-sm" :style="{ height: `${(krw / peak) * 100}%` }" />
            </div>
          </div>
          <div class="text-muted-foreground mt-1 flex justify-between text-[10px] tabular-nums">
            <span>1</span><span>{{ Math.ceil(daily.length / 2) }}</span><span>{{ daily.length }}</span>
          </div>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <section v-for="g in groups" :key="g.title" class="min-w-0">
            <p class="text-muted-foreground mb-2 text-xs font-medium">
              {{ g.title }}
            </p>
            <ul class="flex flex-col gap-1.5 text-sm">
              <li v-for="r in g.rows.slice(0, 8)" :key="r.key" class="flex flex-col gap-0.5">
                <div class="flex items-baseline gap-2">
                  <span class="min-w-0 flex-1 truncate" :title="r.label">{{ r.label }}</span>
                  <span class="text-muted-foreground shrink-0 text-xs">{{ t.count(r.count) }}</span>
                  <span class="w-20 shrink-0 text-right tabular-nums">{{ formatKrw(r.krw) }}</span>
                </div>
                <div class="bg-muted h-1 overflow-hidden rounded-full">
                  <div class="bg-primary/70 h-full rounded-full" :style="{ width: `${total ? (r.krw / total) * 100 : 0}%` }" />
                </div>
              </li>
            </ul>
          </section>
        </div>
        <div>
          <p class="text-muted-foreground mb-2 text-xs font-medium">
            {{ t.jobs }}
          </p>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="text-muted-foreground text-left text-xs">
                <tr>
                  <th class="py-1.5 pr-3 font-medium">{{ t.cols.at }}</th>
                  <th class="py-1.5 pr-3 font-medium">{{ t.cols.type }}</th>
                  <th class="py-1.5 pr-3 font-medium">{{ t.cols.where }}</th>
                  <th class="py-1.5 pr-3 font-medium">{{ t.cols.who }}</th>
                  <th class="py-1.5 pr-3 font-medium">{{ t.cols.status }}</th>
                  <th class="py-1.5 text-right font-medium">{{ t.cols.cost }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="j in list.slice(0, shown)" :key="j.id" class="border-t">
                  <td class="text-muted-foreground py-1.5 pr-3 whitespace-nowrap tabular-nums">{{ clock(j) }}</td>
                  <td class="py-1.5 pr-3 whitespace-nowrap">{{ ko.notifications.types[j.type] ?? j.type }}</td>
                  <td class="max-w-56 truncate py-1.5 pr-3">
                    <NuxtLink v-if="epOf(j.target?.episodeId)" class="hover:underline" :to="{ path: '/studio', query: { episode: j.target!.episodeId, ...(j.target?.panelId ? { panel: j.target.panelId } : {}) } }">
                      {{ where_(j.target?.episodeId) }}
                    </NuxtLink>
                  </td>
                  <td class="py-1.5 pr-3 whitespace-nowrap">{{ j.requestedBy ? names[j.requestedBy] ?? '' : '' }}</td>
                  <td class="py-1.5 pr-3 whitespace-nowrap" :class="j.status === 'failed' ? 'text-destructive' : ''">{{ ko.queue.status[j.status] }}</td>
                  <td class="py-1.5 text-right whitespace-nowrap tabular-nums">{{ formatKrw(j.costKrw ?? 0) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Button v-if="list.length > shown" variant="outline" size="sm" class="mt-2" @click="shown += 50">
            {{ t.more }}
          </Button>
        </div>
      </template>
    </CardContent>
  </Card>
</template>
