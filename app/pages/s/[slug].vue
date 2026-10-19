<script setup lang="ts">
import type { IntakePage } from '#shared/intake'
import { doc, getDoc } from 'firebase/firestore'
import { toast } from 'vue-sonner'
import type { ReportReason } from '#shared/reports'
import { CONSENT_TEXT, INTAKE_LIMITS } from '#shared/intake'
import { REPORT_REASONS } from '#shared/reports'
import { errorMessage } from '~/lib/errors'
import { callFn } from '~/lib/functions'
import { ko } from '~/locales/ko'

// INB-02~06: 로그인 없이 쓰는 공개 제보 페이지
definePageMeta({ layout: false })
const t = ko.intake
const route = useRoute()
const { $firestore, $functions } = useNuxtApp()
const slug = String(route.params.slug ?? '')
const page = ref<IntakePage | null>(null)
const state = ref<'loading' | 'missing' | 'form' | 'done'>('loading')
const blocked = ref(false)
onMounted(async () => {
  const snap = await getDoc(doc($firestore, 'intake', slug)).catch(() => null)
  page.value = snap?.exists() ? (snap.data() as IntakePage) : null
  blocked.value = !!(await getDoc(doc($firestore, 'intakeBlocks', slug)).catch(() => null))?.exists()
  state.value = page.value ? 'form' : 'missing'
})

const form = reactive({ body: '', answers: [] as string[], nickname: '', email: '', consent: false, credit: false, notify: false, website: '' })
const statusLink = ref('')
const images = ref<{ name: string, b64: string }[]>([])
const sending = ref(false)
const error = ref('')

async function onImages(e: Event) {
  const input = e.target as HTMLInputElement
  const files = [...(input.files ?? [])].slice(0, INTAKE_LIMITS.images)
  input.value = ''
  if (files.some(f => f.size > INTAKE_LIMITS.imageBytes)) {
    error.value = t.imageTooBig
    return
  }
  images.value = await Promise.all(files.map(f => new Promise<{ name: string, b64: string }>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve({ name: f.name, b64: String(r.result).split(',')[1] ?? '' })
    r.onerror = reject
    r.readAsDataURL(f)
  })))
}

async function send() {
  error.value = ''
  sending.value = true
  try {
    const r = await callFn($functions, 'submitIntake', {
      slug,
      body: form.body,
      answers: form.answers.slice(0, page.value!.questions.length).map(a => a ?? ''),
      nickname: form.nickname,
      email: form.email,
      consent: true,
      credit: form.credit && !!form.nickname.trim(),
      notify: form.notify && !!form.email.trim(),
      images: page.value!.images ? images.value.map(i => i.b64) : [],
      website: form.website,
    })
    statusLink.value = `${window.location.origin}/s/r/${r.token}`
    state.value = 'done'
  }
  catch (e) {
    error.value = errorMessage(e) ?? ko.errors.unknown
  }
  finally {
    sending.value = false
  }
}

// CMN-40 페이지 신고
const report = reactive({ reason: 'spam' as ReportReason, detail: '' })
const reporting = ref(false)
async function sendReport() {
  reporting.value = true
  try {
    await callFn($functions, 'reportPage', { slug, reason: report.reason, detail: report.detail })
    report.detail = ''
    toast.success(t.report.sent)
  }
  catch (e) {
    toast.error(errorMessage(e) ?? ko.errors.unknown)
  }
  finally {
    reporting.value = false
  }
}

async function copyStatus() {
  await navigator.clipboard.writeText(statusLink.value)
  toast.success(t.copied)
}

function again() {
  Object.assign(form, { body: '', answers: [], consent: false, credit: false, notify: false })
  images.value = []
  state.value = 'form'
}
</script>

<template>
  <main class="mx-auto flex min-h-svh w-full max-w-xl flex-col gap-6 p-6">
    <p class="text-sm font-bold tracking-wide">
      {{ ko.brand.name }}
    </p>
    <p v-if="state === 'loading'" class="text-muted-foreground text-sm">
      …
    </p>
    <p v-else-if="state === 'missing'" class="py-16 text-center">
      {{ t.notFound }}
    </p>
    <template v-else-if="page">
      <header class="flex flex-col gap-2">
        <h1 class="text-2xl font-bold">
          {{ page.name }}
        </h1>
        <p v-if="page.intro" class="whitespace-pre-wrap text-sm">
          {{ page.intro }}
        </p>
        <p v-if="page.topics" class="bg-muted rounded-md p-3 text-sm">
          <b>{{ t.topics }}</b> · {{ page.topics }}
        </p>
      </header>
      <p v-if="!page.enabled || blocked" class="py-16 text-center text-lg font-medium" role="status">
        {{ blocked ? t.blocked : t.closed }}
      </p>
      <section v-else-if="state === 'done'" class="flex flex-col items-start gap-3 py-8" role="status">
        <p class="text-lg font-bold">
          {{ t.thanks }}
        </p>
        <p class="text-muted-foreground text-sm">
          {{ t.thanksBody }}
        </p>
        <div class="bg-muted flex w-full flex-col gap-1.5 rounded-md p-3 text-sm">
          <span class="font-medium">{{ t.statusLink }}</span>
          <div class="flex items-center gap-2">
            <a :href="statusLink" class="text-primary truncate text-xs underline" data-testid="status-link">{{ statusLink }}</a>
            <Button size="sm" variant="outline" @click="copyStatus">{{ t.copy }}</Button>
          </div>
          <p class="text-muted-foreground text-xs">{{ t.statusHint }}</p>
        </div>
        <Button variant="outline" @click="again">
          {{ t.again }}
        </Button>
      </section>
      <form v-else class="flex flex-col gap-4" @submit.prevent="send">
        <div class="flex flex-col gap-1.5">
          <Label for="in-body">{{ t.body }}</Label>
          <Textarea id="in-body" v-model="form.body" rows="10" :maxlength="INTAKE_LIMITS.body" required />
          <p class="text-muted-foreground text-xs">
            {{ t.bodyHint(form.body.trim().length, INTAKE_LIMITS.minBody) }}
          </p>
        </div>
        <div v-for="(q, i) in page.questions" :key="i" class="flex flex-col gap-1.5">
          <Label :for="`in-q${i}`">{{ q }}</Label>
          <Textarea :id="`in-q${i}`" v-model="form.answers[i]" rows="2" :maxlength="INTAKE_LIMITS.answer" />
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <Label for="in-nick">{{ t.nickname }}</Label>
            <Input id="in-nick" v-model="form.nickname" :maxlength="INTAKE_LIMITS.nickname" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="in-email">{{ t.email }}</Label>
            <Input id="in-email" v-model="form.email" type="email" :maxlength="INTAKE_LIMITS.email" />
          </div>
        </div>
        <div v-if="page.images" class="flex flex-col gap-1.5">
          <Label for="in-img">{{ t.images(INTAKE_LIMITS.images) }}</Label>
          <input id="in-img" type="file" accept="image/png,image/jpeg,image/webp" multiple class="text-sm" @change="onImages">
          <p class="text-muted-foreground text-xs">
            {{ t.imagesWarn }}
          </p>
          <p v-if="images.length" class="text-xs">
            {{ images.map(i => i.name).join(', ') }}
          </p>
        </div>
        <input v-model="form.website" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="absolute -left-[9999px] h-0 w-0 opacity-0">
        <p class="text-muted-foreground text-xs">
          {{ t.age }}
        </p>
        <label class="flex items-start gap-2 text-sm">
          <input v-model="form.consent" type="checkbox" class="mt-1" :aria-label="t.consent" required>
          <span><b>{{ t.consent }}</b> {{ page.consentText || CONSENT_TEXT }}</span>
        </label>
        <label class="flex items-start gap-2 text-sm">
          <input v-model="form.credit" type="checkbox" class="mt-1" :aria-label="t.credit" :disabled="!form.nickname.trim()">
          <span>{{ t.credit }}</span>
        </label>
        <label class="flex items-start gap-2 text-sm">
          <input v-model="form.notify" type="checkbox" class="mt-1" :aria-label="t.notify" :disabled="!form.email.trim()">
          <span>{{ t.notify }}</span>
        </label>
        <p v-if="error" class="text-destructive text-sm" role="alert">
          {{ error }}
        </p>
        <Button type="submit" class="self-start" :disabled="sending || !form.consent || form.body.trim().length < INTAKE_LIMITS.minBody">
          {{ sending ? t.sending : t.submit }}
        </Button>
      </form>
      <details class="text-muted-foreground border-t pt-3 text-xs">
        <summary class="cursor-pointer">
          {{ t.report.open }}
        </summary>
        <form class="mt-2 flex flex-col gap-2" @submit.prevent="sendReport">
          <select v-model="report.reason" class="border-input bg-card h-8 rounded-md border px-2 text-sm" :aria-label="t.report.reason">
            <option v-for="r in REPORT_REASONS" :key="r" :value="r">
              {{ ko.report.reasons[r] }}
            </option>
          </select>
          <Textarea v-model="report.detail" rows="2" maxlength="500" :aria-label="t.report.detail" :placeholder="t.report.detail" />
          <Button size="sm" variant="outline" type="submit" class="self-start" :disabled="reporting">
            {{ t.report.send }}
          </Button>
        </form>
      </details>
    </template>
  </main>
</template>
