<script setup lang="ts">
import { toast } from 'vue-sonner'
import { errorMessage } from '~/lib/errors'
import { safeRedirect } from '~/lib/paths'
import { ko } from '~/locales/ko'

definePageMeta({ layout: 'auth' })

const auth = useAuthStore()
const route = useRoute()
const redirect = computed(() => safeRedirect(route.query.redirect))

const email = ref('')
const password = ref('')
const signUp = ref(false)
const sentTo = ref('')
const notice = ref('')
const pending = ref<'google' | 'email' | 'password' | 'reset' | null>(null)

function fail(error: unknown) {
  const message = errorMessage(error)
  if (message) toast.error(message)
}

async function google() {
  pending.value = 'google'
  try {
    await auth.signInWithGoogle()
    await navigateTo(redirect.value)
  }
  catch (error) {
    fail(error)
  }
  finally {
    pending.value = null
  }
}

async function withPassword() {
  pending.value = 'password'
  try {
    const address = email.value.trim()
    if (signUp.value) await auth.signUpWithPassword(address, password.value)
    else await auth.signInWithPassword(address, password.value)
    await navigateTo(redirect.value)
  }
  catch (error) {
    fail(error)
  }
  finally {
    pending.value = null
  }
}

async function reset() {
  const address = email.value.trim()
  if (!address) return toast.error(ko.login.needEmail)
  pending.value = 'reset'
  try {
    await auth.sendPasswordReset(address)
    notice.value = ko.login.resetSent(address)
  }
  catch (error) {
    fail(error)
  }
  finally {
    pending.value = null
  }
}

async function sendLink() {
  const address = email.value.trim()
  if (!address) return toast.error(ko.login.needEmail)
  pending.value = 'email'
  try {
    await auth.sendEmailLink(address, redirect.value)
    sentTo.value = address
  }
  catch (error) {
    fail(error)
  }
  finally {
    pending.value = null
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ ko.login.title }}</CardTitle>
      <CardDescription>{{ ko.login.description }}</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <Button variant="outline" :disabled="pending !== null" @click="google">
        {{ ko.login.google }}
      </Button>
      <div class="text-muted-foreground flex items-center gap-3 text-xs">
        <Separator class="flex-1" />
        {{ ko.login.or }}
        <Separator class="flex-1" />
      </div>
      <p v-if="sentTo" class="bg-muted rounded-md px-3 py-2 text-sm" role="status">
        {{ ko.login.linkSent(sentTo) }}
      </p>
      <template v-else>
        <form class="flex flex-col gap-2" @submit.prevent="withPassword">
          <Label for="email">{{ ko.login.emailLabel }}</Label>
          <Input id="email" v-model="email" type="email" autocomplete="email" required :placeholder="ko.login.emailPlaceholder" />
          <Label for="password" class="mt-2">{{ ko.login.passwordLabel }}</Label>
          <Input
            id="password"
            v-model="password"
            type="password"
            :autocomplete="signUp ? 'new-password' : 'current-password'"
            minlength="6"
            required
            :placeholder="ko.login.passwordPlaceholder"
          />
          <Button type="submit" :disabled="pending !== null || !email || !password">
            {{ signUp ? ko.login.signUp : ko.login.signIn }}
          </Button>
          <div class="flex justify-between text-xs">
            <button type="button" class="text-muted-foreground underline" @click="signUp = !signUp">
              {{ signUp ? ko.login.toSignIn : ko.login.toSignUp }}
            </button>
            <button type="button" class="text-muted-foreground underline" :disabled="pending !== null" @click="reset">
              {{ ko.login.forgot }}
            </button>
          </div>
          <p v-if="notice" class="bg-muted rounded-md px-3 py-2 text-sm" role="status">
            {{ notice }}
          </p>
        </form>
        <Button variant="outline" :disabled="pending !== null" @click="sendLink">
          {{ ko.login.sendLink }}
        </Button>
      </template>
      <NuxtLink to="/welcome#waitlist" class="text-muted-foreground text-center text-xs underline">
        {{ ko.login.noAccount }}
      </NuxtLink>
    </CardContent>
  </Card>
</template>
