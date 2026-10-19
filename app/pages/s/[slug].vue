<script setup lang="ts">
import type { IntakePage } from '#shared/intake'
import { doc, getDoc } from 'firebase/firestore'
import { CONSENT_TEXT, INTAKE_LIMITS } from '#shared/intake'
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
onMounted(async () => {
  const snap = await getDoc(doc($firestore, 'intake', slug)).catch(() => null)
  page.value = snap?.exists() ? (snap.data() as IntakePage) : null
  state.value = page.value ? 'form' : 'missing'
})

const form = reactive({ body: '', answers: [] as string[], nickname: '', email: '', consent: false, website: '' })
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
    await callFn($functions, 'submitIntake', {
      slug,
      body: form.body,
      answers: form.answers.slice(0, page.value!.questions.length).map(a => a ?? ''),
      nickname: form.nickname,
      email: form.email,
      consent: true,
      images: page.value!.images ? images.value.map(i => i.b64) : [],
      website: form.website,
    })
    state.value = 'done'
  }
  catch (e) {
    error.value = errorMessage(e) ?? ko.errors.unknown
  }
  finally {
    sending.value = false
  }
}

function again() {
  Object.assign(form, { body: '', answers: [], consent: false })
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
      <p v-if="!page.enabled" class="py-16 text-center text-lg font-medium" role="status">
        {{ t.closed }}
      </p>
      <section v-else-if="state === 'done'" class="flex flex-col items-start gap-3 py-8" role="status">
        <p class="text-lg font-bold">
          {{ t.thanks }}
        </p>
        <p class="text-muted-foreground text-sm">
          {{ t.thanksBody }}
        </p>
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
          <span><b>{{ t.consent }}</b> {{ CONSENT_TEXT }}</span>
        </label>
        <p v-if="error" class="text-destructive text-sm" role="alert">
          {{ error }}
        </p>
        <Button type="submit" class="self-start" :disabled="sending || !form.consent || form.body.trim().length < INTAKE_LIMITS.minBody">
          {{ sending ? t.sending : t.submit }}
        </Button>
      </form>
    </template>
  </main>
</template>
