<script setup lang="ts">
import type { Report, ReportAction } from '#shared/reports'
import type { WaitlistAction, WaitlistEntry } from '#shared/waitlist'
import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore'
import { toast } from 'vue-sonner'
import { DEFAULT_LIMITS, DEFAULT_MODELS, limitsConfig, modelsConfig, parseEmails } from '#shared/config'
import { errorMessage } from '~/lib/errors'
import { callFn } from '~/lib/functions'
import { ko } from '~/locales/ko'

// CMN-50: 운영자 설정. 규칙이 admin 클레임으로 다시 막는다
const { $auth, $firestore, $functions } = useNuxtApp()
const t = ko.admin
const isAdmin = ref<boolean | null>(null)
const emails = ref('')
const limits = reactive({ ...DEFAULT_LIMITS })
const modelsText = ref('')

onMounted(async () => {
  const token = await $auth.currentUser?.getIdTokenResult()
  isAdmin.value = token?.claims.admin === true
  if (!isAdmin.value) return
  const [access, lim, models] = await Promise.all(['access', 'limits', 'models'].map(id => getDoc(doc($firestore, 'config', id))))
  emails.value = ((access!.get('allowedEmails') as string[] | undefined) ?? []).join('\n')
  Object.assign(limits, { ...DEFAULT_LIMITS, ...lim!.data() })
  modelsText.value = JSON.stringify({ ...DEFAULT_MODELS, ...models!.data() }, null, 2)
  await loadReports()
  await loadWaitlist()
})

async function save(id: string, data: Record<string, unknown>) {
  try {
    await setDoc(doc($firestore, 'config', id), data)
    toast.success(t.saved)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.unknown)
  }
}

// CMN-40·53 신고 처리
const reports = ref<Report[]>([])
const notes = reactive<Record<string, string>>({})
async function loadReports() {
  const snap = await getDocs(query(collection($firestore, 'reports'), orderBy('createdAt', 'desc'), limit(50)))
  reports.value = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Report)
}
async function resolve(r: Report, action: ReportAction) {
  try {
    await callFn($functions, 'resolveReport', { reportId: r.id, action, note: notes[r.id] ?? '' })
    toast.success(t.saved)
    await loadReports()
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.unknown)
  }
}
// CMN-52 대기 명단
const waitlist = ref<WaitlistEntry[]>([])
const showDecided = ref(false)
const shownWaitlist = computed(() => waitlist.value.filter(w => showDecided.value || w.status === 'pending'))
async function loadWaitlist() {
  const snap = await getDocs(query(collection($firestore, 'waitlist'), orderBy('createdAt', 'desc'), limit(200)))
  waitlist.value = snap.docs.map(d => ({ id: d.id, ...d.data() }) as WaitlistEntry)
}
async function decide(w: WaitlistEntry, action: WaitlistAction) {
  try {
    await callFn($functions, 'decideWaitlist', { id: w.id, action })
    toast.success(t.saved)
    await loadWaitlist()
    if (action === 'approve') emails.value = [...new Set([...parseEmails(emails.value), w.email])].join('\n')
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.unknown)
  }
}
const when = (ts?: { toMillis: () => number }) => (ts ? new Date(ts.toMillis()).toLocaleString('ko-KR') : '')

const saveAccess = () => save('access', { allowedEmails: parseEmails(emails.value) })

function saveLimits() {
  const parsed = limitsConfig.safeParse({ ...limits })
  if (!parsed.success) return toast.error(t.invalid)
  return save('limits', parsed.data)
}

function saveModels() {
  let json: unknown
  try {
    json = JSON.parse(modelsText.value)
  }
  catch {
    return toast.error(t.invalid)
  }
  const parsed = modelsConfig.safeParse(json)
  if (!parsed.success) return toast.error(t.invalid)
  return save('models', parsed.data)
}
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-6 p-8">
    <h1 class="text-2xl font-bold">
      {{ t.title }}
    </h1>
    <p v-if="isAdmin === false" class="text-muted-foreground">
      {{ t.notAdmin }}
    </p>
    <template v-else-if="isAdmin">
      <Card>
        <CardHeader>
          <CardTitle>{{ t.access }}</CardTitle>
          <CardDescription>{{ t.accessHint }}</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-2">
          <Textarea v-model="emails" rows="5" />
          <Button class="self-start" @click="saveAccess">
            {{ t.save }}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{{ t.limits }}</CardTitle>
        </CardHeader>
        <CardContent class="grid grid-cols-3 gap-4">
          <div class="flex flex-col gap-2">
            <Label for="ml">{{ t.monthlyLimit }}</Label>
            <Input id="ml" v-model.number="limits.monthlyLimitKrw" type="number" min="0" step="1000" />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="co">{{ t.confirmOver }}</Label>
            <Input id="co" v-model.number="limits.confirmOverKrw" type="number" min="0" step="500" />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="mc">{{ t.maxConcurrent }}</Label>
            <Input id="mc" v-model.number="limits.maxConcurrentJobs" type="number" min="1" max="20" />
          </div>
          <Button class="col-span-3 self-start justify-self-start" @click="saveLimits">
            {{ t.save }}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{{ t.models }}</CardTitle>
          <CardDescription>{{ t.modelsHint }}</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-2">
          <Textarea v-model="modelsText" rows="12" class="font-mono text-xs" />
          <Button class="self-start" @click="saveModels">
            {{ t.save }}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{{ t.waitlist }}</CardTitle>
          <CardDescription>{{ t.waitlistHint }}</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-2">
          <label class="flex items-center gap-2 text-xs"><input v-model="showDecided" type="checkbox">{{ t.showDecided }}</label>
          <p v-if="!shownWaitlist.length" class="text-muted-foreground text-sm">
            {{ t.noWaitlist }}
          </p>
          <div v-for="w in shownWaitlist" :key="w.id" class="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
            <span class="rounded px-1.5 py-0.5 text-xs" :class="w.status === 'pending' ? 'bg-amber-100 text-amber-900' : 'bg-muted'">{{ t.waitStatus[w.status] }}</span>
            <span class="font-medium">{{ w.name }}</span>
            <span>{{ w.email }}</span>
            <span v-if="w.handle" class="text-muted-foreground text-xs">{{ w.handle }}</span>
            <span class="text-muted-foreground text-xs">{{ when(w.createdAt) }}</span>
            <p v-if="w.note" class="w-full whitespace-pre-wrap text-xs">
              {{ w.note }}
            </p>
            <div v-if="w.status === 'pending'" class="ml-auto flex gap-1">
              <Button size="sm" @click="decide(w, 'approve')">
                {{ t.waitAction.approve }}
              </Button>
              <Button size="sm" variant="ghost" @click="decide(w, 'reject')">
                {{ t.waitAction.reject }}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{{ t.reports }}</CardTitle>
          <CardDescription>{{ t.reportsHint }}</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-3">
          <p v-if="!reports.length" class="text-muted-foreground text-sm">
            {{ t.noReports }}
          </p>
          <div v-for="r in reports" :key="r.id" class="flex flex-col gap-1.5 rounded-md border p-3 text-sm">
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded px-1.5 py-0.5 text-xs" :class="r.status === 'open' ? 'bg-red-100 text-red-900' : 'bg-muted'">{{ t.reportStatus[r.status] }}</span>
              <span class="font-medium">{{ t.reportKind[r.kind] }} · {{ ko.report.reasons[r.reason] }}</span>
              <a v-if="r.slug" :href="`/s/${r.slug}`" target="_blank" rel="noopener" class="text-primary text-xs underline">/s/{{ r.slug }}</a>
              <span class="text-muted-foreground text-xs">{{ r.workspaceId }}<template v-if="r.submissionId"> / {{ r.submissionId }}</template> · {{ when(r.createdAt) }}</span>
            </div>
            <p v-if="r.detail" class="whitespace-pre-wrap">
              {{ r.detail }}
            </p>
            <p v-for="(l, i) in r.log ?? []" :key="i" class="text-muted-foreground text-xs">
              {{ new Date(l.at).toLocaleString('ko-KR') }} · {{ t.reportAction[l.action] }}<template v-if="l.note"> · {{ l.note }}</template>
            </p>
            <div class="flex flex-wrap items-center gap-2">
              <Input v-model="notes[r.id]" class="h-8 max-w-xs text-xs" :placeholder="t.reportNote" :aria-label="t.reportNote" />
              <Button v-if="r.slug" size="sm" variant="destructive" @click="resolve(r, 'block')">
                {{ t.reportAction.block }}
              </Button>
              <Button v-if="r.slug" size="sm" variant="outline" @click="resolve(r, 'unblock')">
                {{ t.reportAction.unblock }}
              </Button>
              <Button size="sm" variant="ghost" @click="resolve(r, 'dismiss')">
                {{ t.reportAction.dismiss }}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
