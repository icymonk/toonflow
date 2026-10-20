<script setup lang="ts">
import { toast } from 'vue-sonner'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

definePageMeta({ layout: 'auth' })

const auth = useAuthStore()
const pending = ref(false)
const unverified = computed(() => !!auth.user && !auth.user.emailVerified)

async function resend() {
  try {
    await auth.resendVerification()
    toast.success(ko.waiting.resent)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.unknown)
  }
}

async function retry() {
  pending.value = true
  try {
    await auth.retryAccount()
    if (!auth.blocked) await navigateTo('/')
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.unknown)
  }
  finally {
    pending.value = false
  }
}

async function other() {
  await auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ unverified ? ko.waiting.verifyTitle : ko.waiting.title }}</CardTitle>
      <CardDescription>{{ (unverified ? ko.waiting.verify : ko.waiting.description)(auth.user?.email ?? '') }}</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-2">
      <Button :loading="pending" @click="retry">
        {{ ko.waiting.retry }}
      </Button>
      <Button v-if="unverified" variant="outline" @click="resend">
        {{ ko.waiting.resend }}
      </Button>
      <Button variant="outline" @click="other">
        {{ ko.waiting.other }}
      </Button>
      <NuxtLink to="/welcome#waitlist" class="text-muted-foreground text-center text-xs underline">
        {{ ko.waiting.join }}
      </NuxtLink>
    </CardContent>
  </Card>
</template>
