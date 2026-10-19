<script setup lang="ts">
import { toast } from 'vue-sonner'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

definePageMeta({ layout: 'auth' })

const auth = useAuthStore()
const pending = ref(false)

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
      <CardTitle>{{ ko.waiting.title }}</CardTitle>
      <CardDescription>{{ ko.waiting.description(auth.user?.email ?? '') }}</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-2">
      <Button :disabled="pending" @click="retry">
        {{ ko.waiting.retry }}
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
