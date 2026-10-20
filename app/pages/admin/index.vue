<script setup lang="ts">
import type { AdminOverview, AdminView, OverviewRow } from '#shared/activity'
import type { Feedback, FeedbackStatus } from '#shared/feedback'
import type { Plan } from '#shared/usage'
import type { Report, ReportAction } from '#shared/reports'
import type { WaitlistAction, WaitlistEntry } from '#shared/waitlist'
import { collection, collectionGroup, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore'
import { toast } from 'vue-sonner'
import { failRate } from '#shared/activity'
import { FEEDBACK_STATUSES } from '#shared/feedback'
import { PLANS } from '#shared/usage'
import { DEFAULT_LIMITS, DEFAULT_MODELS, limitsConfig, modelsConfig, parseEmails } from '#shared/config'
import { errorMessage } from '~/lib/errors'
import { callFn } from '~/lib/functions'
import { ko } from '~/locales/ko'

// CMN-50: 운영자 설정. 규칙이 admin 클레임으로 다시 막는다
const { $auth, $firestore, $functions } = useNuxtApp()
const t = ko.admin
const isAdmin = ref<boolean | null>(null)
const emails = ref('')
const limits = reactive({ ...DEFAULT_LIMITS, planLimitsKrw: { ...DEFAULT_LIMITS.planLimitsKrw } })
const modelsText = ref('')

onMounted(async () => {
  const token = await $auth.currentUser?.getIdTokenResult()
  isAdmin.value = token?.claims.admin === true
  if (!isAdmin.value) return
  const [access, lim, models] = await Promise.all(['access', 'limits', 'models'].map(id => getDoc(doc($firestore, 'config', id))))
  emails.value = ((access!.get('allowedEmails') as string[] | undefined) ?? []).join('\n')
  Object.assign(limits, { ...DEFAULT_LIMITS, ...lim!.data(), planLimitsKrw: { ...DEFAULT_LIMITS.planLimitsKrw, ...lim!.get('planLimitsKrw') } })
  modelsText.value = JSON.stringify({ ...DEFAULT_MODELS, ...models!.data() }, null, 2)
  await loadReports()
  await loadFeedback()
  await loadWaitlist()
  await loadOverview()
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

// CMN-63 피드백
const feedbacks = ref<Feedback[]>([])
const fbFilter = ref<FeedbackStatus | ''>('open')
const fbOpen = ref('')
const shownFeedback = computed(() => feedbacks.value.filter(f => !fbFilter.value || f.status === fbFilter.value))
async function loadFeedback() {
  const snap = await getDocs(query(collection($firestore, 'feedback'), orderBy('createdAt', 'desc'), limit(200)))
  feedbacks.value = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Feedback)
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
// CMN-51 전체 현황 · CMN-54 열람 기록
const overview = ref<AdminOverview | null>(null)
const views = ref<AdminView[]>([])
const opened = reactive<Record<string, { episodes: number, submissions: number, members: number }>>({})
async function loadOverview() {
  overview.value = await callFn($functions, 'adminOverview', {}).catch(() => null)
  const snap = await getDocs(query(collectionGroup($firestore, 'adminViews'), orderBy('at', 'desc'), limit(50))).catch(() => null)
  views.value = snap ? snap.docs.map(d => ({ id: d.id, ...d.data() }) as AdminView) : []
}
// AIU-24 요금제·크레딧 직접 지급 (결제 연동 전)
const editingPlan = ref<string>()
const grant = reactive({ plan: 'free' as Plan, creditKrw: 0 })
const granting = ref(false)
function editPlan(r: OverviewRow) {
  editingPlan.value = editingPlan.value === r.id ? undefined : r.id
  Object.assign(grant, { plan: r.plan, creditKrw: 0 })
}
async function savePlan(id: string) {
  granting.value = true
  try {
    await callFn($functions, 'grantPlan', { workspaceId: id, plan: grant.plan, creditKrw: Number(grant.creditKrw) || 0 })
    toast.success(t.granted)
    editingPlan.value = undefined
    await loadOverview()
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.unknown)
  }
  finally {
    granting.value = false
  }
}
async function openWs(id: string) {
  const reason = (await promptDialog(t.viewReason))?.trim()
  if (!reason) return
  try {
    opened[id] = await callFn($functions, 'logAdminView', { workspaceId: id, reason })
    await loadOverview()
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
  <AppForbidden v-if="isAdmin === false" />
  <div v-else class="mx-auto flex max-w-2xl flex-col gap-6 p-8">
    <h1 class="text-2xl font-bold">
      {{ t.title }}
    </h1>
    <template v-if="isAdmin">
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
          <div v-for="p in (['basic', 'pro'] as const)" :key="p" class="flex flex-col gap-2">
            <Label :for="`pl-${p}`">{{ t.planLimit(ko.plans[p]) }}</Label>
            <Input :id="`pl-${p}`" v-model.number="limits.planLimitsKrw[p]" type="number" min="0" step="1000" />
          </div>
          <div />
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
          <CardTitle>{{ t.overview }}</CardTitle>
          <CardDescription v-if="overview">{{ t.overviewLine(overview.month, overview.workspaces, overview.spentKrw, overview.jobs, failRate(overview.jobs, overview.failed)) }}</CardDescription>
        </CardHeader>
        <CardContent v-if="overview" class="flex flex-col gap-3 text-xs">
          <p v-for="(m, id) in overview.byModel" :key="id">{{ id }} · {{ t.modelLine(m.total, failRate(m.total, m.failed)) }}</p>
          <table class="w-full text-left">
            <thead class="text-muted-foreground"><tr><th class="py-1 font-normal">{{ t.wsName }}</th><th class="font-normal">{{ t.wsSpent }}</th><th /></tr></thead>
            <tbody>
              <template v-for="r in overview.rows" :key="r.id">
              <tr class="border-t">
                <td class="py-1.5">{{ r.name }} <span class="text-muted-foreground">{{ r.id }}</span><span v-if="r.deleteAt" class="text-destructive"> · {{ t.wsDeleting }}</span><br><span class="text-muted-foreground">{{ t.wsPlan(ko.plans[r.plan], r.limitKrw, r.creditKrw) }}</span></td>
                <td>₩{{ r.spentKrw.toLocaleString() }}</td>
                <td class="text-right">
                  <span v-if="opened[r.id]" class="text-muted-foreground mr-2">{{ t.wsCounts(opened[r.id]!.episodes, opened[r.id]!.submissions, opened[r.id]!.members) }}</span>
                  <Button size="sm" variant="outline" class="mr-1 h-7" @click="editPlan(r)">{{ t.plan }}</Button>
                  <Button size="sm" variant="outline" class="h-7" @click="openWs(r.id)">{{ t.view }}</Button>
                </td>
              </tr>
              <tr v-if="editingPlan === r.id">
                <td colspan="3" class="pb-2">
                  <form class="flex flex-wrap items-end gap-2" @submit.prevent="savePlan(r.id)">
                    <div class="flex flex-col gap-1">
                      <Label :for="`plan-${r.id}`">{{ t.planSelect }}</Label>
                      <AppSelect :id="`plan-${r.id}`" v-model="grant.plan" class="border-input bg-background h-8 rounded-md border px-2">
                        <option v-for="p in PLANS" :key="p" :value="p">{{ ko.plans[p] }}</option>
                      </AppSelect>
                    </div>
                    <div class="flex flex-col gap-1">
                      <Label :for="`credit-${r.id}`">{{ t.credit }}</Label>
                      <Input :id="`credit-${r.id}`" v-model.number="grant.creditKrw" type="number" min="0" step="1000" class="h-8 w-36" />
                    </div>
                    <Button type="submit" size="sm" :loading="granting">{{ t.grant }}</Button>
                  </form>
                </td>
              </tr>
              </template>
            </tbody>
          </table>
          <div v-if="views.length" class="flex flex-col gap-1 border-t pt-2">
            <span class="font-medium">{{ t.views }}</span>
            <p v-for="v in views" :key="v.id">{{ v.at ? new Date(v.at.toMillis()).toLocaleString('ko-KR') : '' }} · {{ v.email ?? v.by }} · {{ v.workspaceId }} · {{ v.reason }}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{{ t.waitlist }}</CardTitle>
          <CardDescription>{{ t.waitlistHint }}</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-2">
          <label class="flex items-center gap-2 text-xs"><AppCheck v-model="showDecided" />{{ t.showDecided }}</label>
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
          <CardTitle>{{ ko.feedback.adminTitle }}</CardTitle>
          <CardDescription>{{ ko.feedback.adminHint }}</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-2">
          <AppSelect v-model="fbFilter" :aria-label="ko.feedback.filter" class="border-input bg-card h-8 w-36 rounded-md border px-2 text-xs">
            <option value="">
              {{ ko.feedback.all }} ({{ feedbacks.length }})
            </option>
            <option v-for="s in FEEDBACK_STATUSES" :key="s" :value="s">
              {{ ko.feedback.status[s] }} ({{ feedbacks.filter(f => f.status === s).length }})
            </option>
          </AppSelect>
          <p v-if="!shownFeedback.length" class="text-muted-foreground text-sm">
            {{ ko.feedback.none }}
          </p>
          <div v-for="f in shownFeedback" :key="f.id" class="rounded-md border text-sm">
            <button type="button" class="hover:bg-muted flex w-full flex-col gap-0.5 p-3 text-left" @click="fbOpen = fbOpen === f.id ? '' : f.id">
              <span class="text-muted-foreground text-xs">{{ ko.feedback.status[f.status] }} · {{ ko.feedback.kinds[f.kind] }} · {{ f.name || f.email }} · {{ when(f.createdAt) }}</span>
              <span class="line-clamp-2">{{ f.text }}</span>
            </button>
            <div v-if="fbOpen === f.id" class="border-t p-3">
              <AppFeedbackThread :feedback="f" as="admin" @changed="loadFeedback" />
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
