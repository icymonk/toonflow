<script setup lang="ts">
import type { IntakeStatus } from '#shared/intake'
import { TOKEN_RE } from '#shared/intake'
import { errorMessage } from '~/lib/errors'
import { callFn } from '~/lib/functions'
import { ko } from '~/locales/ko'

// INB-12·27: 제보자 확인 링크 — 진행 상황, 게시 링크, 동의 철회
definePageMeta({ layout: false })
const t = ko.intake.status
const route = useRoute()
const { $functions } = useNuxtApp()
const token = String(route.params.token ?? '')
const info = ref<IntakeStatus | null>(null)
const error = ref('')
const busy = ref(false)

async function load() {
  error.value = ''
  try {
    if (!TOKEN_RE.test(token)) throw new Error('token')
    info.value = await callFn($functions, 'intakeStatus', { token })
  }
  catch (e) {
    error.value = errorMessage(e) ?? ko.errors.tokenNotFound
  }
}
onMounted(load)

async function withdraw() {
  if (!window.confirm(t.withdrawConfirm)) return
  busy.value = true
  try {
    await callFn($functions, 'withdrawIntake', { token })
    await load()
  }
  catch (e) {
    error.value = errorMessage(e) ?? ko.errors.unknown
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="mx-auto flex min-h-svh w-full max-w-xl flex-col gap-6 p-6">
    <p class="text-sm font-bold tracking-wide">
      {{ ko.brand.name }}
    </p>
    <h1 class="text-2xl font-bold">
      {{ t.title }}<template v-if="info?.name">
        · {{ info.name }}
      </template>
    </h1>
    <p v-if="error" class="text-destructive text-sm" role="alert">
      {{ error }}
    </p>
    <section v-else-if="info" class="flex flex-col items-start gap-3" role="status">
      <p class="text-lg">
        {{ t[info.state] }}
      </p>
      <a v-for="u in info.urls" :key="u" :href="u" target="_blank" rel="noopener" class="text-primary break-all text-sm underline">{{ u }}</a>
      <Button v-if="info.state !== 'withdrawn' && info.state !== 'withdrawRequested'" variant="outline" :disabled="busy" @click="withdraw">
        {{ t.withdraw }}
      </Button>
    </section>
    <p v-else class="text-muted-foreground text-sm">
      …
    </p>
  </main>
</template>
