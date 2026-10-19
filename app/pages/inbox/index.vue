<script setup lang="ts">
import type { Submission, SubmissionFilter, SubmissionStatus } from '#shared/submissions'
import { Inbox, Plus, Star } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { canEdit } from '#shared/roles'
import { filterSubmissions, MANUAL_SOURCES, MANUAL_STATUSES, parseTags, splitBulk, STATUS_KEYS, SUBMISSION_SOURCES, SUBMISSION_STATUSES, submissionInput, titleFrom } from '#shared/submissions'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

const t = ko.inbox
const auth = useAuthStore()
const { list, loading, add, update, setStatus } = useSubmissions()
const edit = computed(() => canEdit(auth.role))

const STATUS_CLASS: Record<SubmissionStatus, string> = {
  new: 'bg-primary/15 text-foreground',
  reviewing: 'bg-muted text-foreground',
  accepted: 'bg-emerald-100 text-emerald-900',
  onHold: 'bg-amber-100 text-amber-900',
  rejected: 'bg-muted text-muted-foreground',
  used: 'bg-emerald-700 text-white',
  withdrawn: 'bg-red-100 text-red-900',
}
const selectClass = 'border-input bg-card h-9 rounded-md border px-2 text-sm disabled:opacity-50'

async function run(fn: () => Promise<unknown>, ok?: string) {
  try {
    await fn()
    if (ok) toast.success(ok)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.unknown)
  }
}

// INB-01 직접 등록
const adding = ref(false)
const form = reactive({ title: '', body: '', source: 'dm' as (typeof MANUAL_SOURCES)[number], sourceNote: '', tags: '' })
const pieces = computed(() => splitBulk(form.body))
function submit() {
  const tags = parseTags(form.tags)
  const items = pieces.value.map(body => submissionInput.safeParse({
    title: titleFrom(pieces.value.length > 1 ? '' : form.title, body),
    body,
    source: form.source,
    sourceNote: form.sourceNote,
    tags,
  }))
  if (items.length === 0 || items.some(i => !i.success)) return toast.error(ko.errors.invalidInput)
  return run(async () => {
    await add(items.map(i => i.data!))
    Object.assign(form, { title: '', body: '', sourceNote: '' })
    adding.value = false
  }, t.added(items.length))
}

// INB-20 목록·필터
const filter = reactive<SubmissionFilter>({ status: 'all', source: 'all', tag: '', q: '', starred: false, days: 0 })
const shown = computed(() => filterSubmissions(list.value, filter))
const counts = computed(() => {
  const live = list.value.filter(s => !s.deletedAt)
  return Object.fromEntries([['all', live.length], ...SUBMISSION_STATUSES.map(st => [st, live.filter(s => s.status === st).length])]) as Record<string, number>
})
const allTags = computed(() => [...new Set(list.value.flatMap(s => s.tags))].sort())

// INB-21 선택·상태
const currentId = ref<string>()
const current = computed(() => list.value.find(s => s.id === currentId.value))
const checked = ref<string[]>([])
watch(shown, (items) => {
  checked.value = checked.value.filter(id => items.some(s => s.id === id))
})
const isManual = (s: Submission) => (MANUAL_STATUSES as readonly string[]).includes(s.status)
const bulkStatus = ref<SubmissionStatus | ''>('')
function applyStatus(ids: string[], status: SubmissionStatus) {
  const targets = ids.filter(id => list.value.some(s => s.id === id && isManual(s)))
  if (targets.length) void run(() => setStatus(targets, status))
}
function open(s: Submission) {
  currentId.value = s.id
  if (s.status === 'new' && edit.value) void run(() => setStatus([s.id], 'reviewing'))
}

function onKey(e: KeyboardEvent) {
  const el = e.target as HTMLElement
  if (e.metaKey || e.ctrlKey || e.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable) return
  const key = e.key.toLowerCase()
  const items = shown.value
  if (key === 'j' || key === 'k') {
    const i = items.findIndex(s => s.id === currentId.value)
    const next = items[Math.min(items.length - 1, Math.max(0, i + (key === 'j' ? 1 : -1)))]
    if (next) open(next)
    e.preventDefault()
  }
  else if (STATUS_KEYS[key] && edit.value) {
    applyStatus(checked.value.length ? checked.value : currentId.value ? [currentId.value] : [], STATUS_KEYS[key])
    e.preventDefault()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// INB-22 메모·태그·별표
const detail = reactive({ note: '', tags: '' })
watch(currentId, () => {
  detail.note = current.value?.note ?? ''
  detail.tags = current.value?.tags.join(', ') ?? ''
}, { immediate: true })
function saveDetail() {
  const s = current.value
  if (!s) return
  return run(() => update(s.id, { note: detail.note.slice(0, 2000), tags: parseTags(detail.tags) }), t.saved)
}
const toggleStar = (s: Submission) => edit.value && run(() => update(s.id, { starred: !s.starred }))
const date = (s: Submission) => (s.createdAt ? new Date(s.createdAt.toMillis()).toLocaleDateString('ko-KR') : '')
</script>

<template>
  <div class="flex h-full flex-col gap-4 p-8">
    <div class="flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold">
        Inbox <span class="text-muted-foreground text-base font-normal">· 제보함</span>
      </h1>
      <Button v-if="edit" @click="adding = !adding">
        <Plus class="size-4" /> {{ t.add }}
      </Button>
    </div>

    <Card v-if="adding">
      <CardHeader>
        <CardTitle>{{ t.addTitle }}</CardTitle>
        <CardDescription>{{ t.bulkHint }}</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-3" @submit.prevent="submit">
          <div v-if="pieces.length <= 1" class="flex flex-col gap-1.5">
            <Label for="sub-title">{{ t.titleLabel }}</Label>
            <Input id="sub-title" v-model="form.title" maxlength="80" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="sub-body">{{ t.bodyLabel }}</Label>
            <Textarea id="sub-body" v-model="form.body" rows="8" required />
          </div>
          <div class="grid gap-3 sm:grid-cols-3">
            <div class="flex flex-col gap-1.5">
              <Label for="sub-source">{{ t.sourceLabel }}</Label>
              <select id="sub-source" v-model="form.source" :class="selectClass">
                <option v-for="s in MANUAL_SOURCES" :key="s" :value="s">
                  {{ t.source[s] }}
                </option>
              </select>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="sub-note">{{ t.sourceNoteLabel }}</Label>
              <Input id="sub-note" v-model="form.sourceNote" maxlength="200" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="sub-tags">{{ t.tagsLabel }}</Label>
              <Input id="sub-tags" v-model="form.tags" />
            </div>
          </div>
          <div class="flex gap-2">
            <Button type="submit" :disabled="pieces.length === 0">
              {{ t.submit(pieces.length) }}
            </Button>
            <Button type="button" variant="ghost" @click="adding = false">
              {{ t.cancel }}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    <AppEmptyState v-if="!loading && counts.all === 0" :icon="Inbox" :title="ko.empty.inbox.title" :body="ko.empty.inbox.body" />

    <template v-else>
      <div class="flex flex-wrap gap-1" role="tablist">
        <button
          v-for="st in ['all', ...SUBMISSION_STATUSES] as const" :key="st" role="tab" :aria-selected="filter.status === st"
          class="rounded-full px-3 py-1 text-sm" :class="filter.status === st ? 'bg-foreground text-background' : 'hover:bg-muted'"
          @click="filter.status = st"
        >
          {{ st === 'all' ? t.all : t.status[st] }} <span class="opacity-60">{{ counts[st] }}</span>
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Input v-model="filter.q" :placeholder="t.search" class="w-60" />
        <select v-model="filter.source" :class="selectClass" :aria-label="t.sourceLabel">
          <option value="all">
            {{ t.anySource }}
          </option>
          <option v-for="s in SUBMISSION_SOURCES" :key="s" :value="s">
            {{ t.source[s] }}
          </option>
        </select>
        <select v-model="filter.tag" :class="selectClass" :aria-label="t.tagsLabel">
          <option value="">
            {{ t.anyTag }}
          </option>
          <option v-for="tag in allTags" :key="tag" :value="tag">
            #{{ tag }}
          </option>
        </select>
        <select v-model.number="filter.days" :class="selectClass">
          <option :value="0">
            {{ t.anyTime }}
          </option>
          <option v-for="d in [7, 30, 90]" :key="d" :value="d">
            {{ t.days(d) }}
          </option>
        </select>
        <label class="flex items-center gap-1.5 text-sm"><input v-model="filter.starred" type="checkbox"> {{ t.starredOnly }}</label>
        <span class="text-muted-foreground ml-auto text-xs">{{ t.keys }}</span>
      </div>

      <div v-if="checked.length && edit" class="bg-muted flex items-center gap-2 rounded-md px-3 py-2 text-sm">
        {{ t.selected(checked.length) }}
        <select v-model="bulkStatus" :class="selectClass" :aria-label="t.setStatus" @change="bulkStatus && applyStatus(checked, bulkStatus); bulkStatus = ''">
          <option value="">
            {{ t.setStatus }}
          </option>
          <option v-for="st in MANUAL_STATUSES" :key="st" :value="st">
            {{ t.status[st] }}
          </option>
        </select>
      </div>

      <div class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ul class="flex flex-col gap-1 overflow-y-auto">
          <li v-if="shown.length === 0" class="text-muted-foreground py-12 text-center text-sm">
            {{ t.noMatch }}
          </li>
          <li
            v-for="s in shown" :key="s.id"
            class="flex cursor-pointer items-start gap-2 rounded-md border p-3" :class="s.id === currentId ? 'border-primary bg-card' : 'bg-card/60 hover:bg-card'"
            @click="open(s)"
          >
            <input v-if="edit" v-model="checked" type="checkbox" :value="s.id" class="mt-1" :aria-label="s.title" @click.stop>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="rounded px-1.5 py-0.5 text-xs" :class="STATUS_CLASS[s.status]">{{ t.status[s.status] }}</span>
                <span class="truncate font-medium" :class="{ 'opacity-60': s.status === 'rejected' }">{{ s.status === 'withdrawn' ? '—' : s.title }}</span>
              </div>
              <p class="text-muted-foreground mt-1 line-clamp-2 text-sm">
                {{ s.status === 'withdrawn' ? '' : s.body }}
              </p>
              <p class="text-muted-foreground mt-1 text-xs">
                {{ t.source[s.source] }} · {{ date(s) }} <span v-for="tag in s.tags" :key="tag"> #{{ tag }}</span>
              </p>
            </div>
            <button :aria-label="t.star" :aria-pressed="s.starred" @click.stop="toggleStar(s)">
              <Star class="size-4" :class="s.starred ? 'fill-primary text-primary' : 'text-muted-foreground'" />
            </button>
          </li>
        </ul>

        <Card v-if="current" class="overflow-y-auto">
          <CardHeader>
            <CardTitle>{{ current.status === 'withdrawn' ? t.status.withdrawn : current.title }}</CardTitle>
            <CardDescription>{{ t.source[current.source] }}<template v-if="current.sourceNote"> · {{ current.sourceNote }}</template> · {{ date(current) }}</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-4">
            <p v-if="current.status !== 'withdrawn'" class="whitespace-pre-wrap text-sm leading-relaxed">
              {{ current.body }}
            </p>
            <div class="flex items-center gap-2">
              <select
                :value="current.status" :class="selectClass" :aria-label="t.setStatus" :disabled="!edit || !isManual(current)"
                @change="applyStatus([current.id], ($event.target as HTMLSelectElement).value as SubmissionStatus)"
              >
                <option v-for="st in isManual(current) ? MANUAL_STATUSES : [current.status]" :key="st" :value="st">
                  {{ t.status[st] }}
                </option>
              </select>
              <span v-if="!edit" class="text-muted-foreground text-xs">{{ t.readOnly }}</span>
            </div>
            <form class="flex flex-col gap-2" @submit.prevent="saveDetail">
              <Label for="detail-tags">{{ t.tagsLabel }}</Label>
              <Input id="detail-tags" v-model="detail.tags" :disabled="!edit" />
              <Label for="detail-note">{{ t.note }}</Label>
              <Textarea id="detail-note" v-model="detail.note" rows="3" maxlength="2000" :disabled="!edit" />
              <Button v-if="edit" type="submit" class="self-start" size="sm">
                {{ t.save }}
              </Button>
            </form>
            <div class="flex flex-col gap-1 text-sm">
              <span class="font-medium">{{ t.linked }}</span>
              <NuxtLink v-for="id in current.episodeIds" :key="id" :to="`/studio?episode=${id}`" class="text-primary underline">
                {{ id }}
              </NuxtLink>
              <span v-if="current.status === 'accepted'" class="text-muted-foreground text-xs">{{ t.toEpisode }}</span>
            </div>
          </CardContent>
        </Card>
        <p v-else class="text-muted-foreground hidden py-12 text-center text-sm lg:block">
          {{ t.pick }}
        </p>
      </div>
    </template>
  </div>
</template>
