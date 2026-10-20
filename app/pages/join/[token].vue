<script setup lang="ts">
import type { InviteInfo } from '#shared/members'
import { errorMessage } from '~/lib/errors'
import { callFn } from '~/lib/functions'
import { ko } from '~/locales/ko'

// ACC-20: 초대 링크로 들어와 로그인하면 멤버
definePageMeta({ layout: 'auth' })
const t = ko.join
const route = useRoute()
const { $functions } = useNuxtApp()
const token = String(route.params.token ?? '')
const info = ref<InviteInfo | null>(null)
const error = ref('')
const pending = ref(false)

onMounted(async () => {
  try {
    info.value = await callFn($functions, 'inviteInfo', { token })
  }
  catch (e) {
    error.value = errorMessage(e) ?? ko.errors.unknown
  }
})
async function accept() {
  pending.value = true
  try {
    await callFn($functions, 'acceptInvite', { token })
    window.location.assign('/')
  }
  catch (e) {
    error.value = errorMessage(e) ?? ko.errors.unknown
    pending.value = false
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ t.title }}</CardTitle>
      <CardDescription v-if="info">
        {{ t.desc(info.workspaceName, ko.members.roles[info.role] ?? info.role) }}
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-2">
      <p v-if="error" class="text-destructive text-sm" role="alert">
        {{ error }}
      </p>
      <p v-else-if="!info" class="text-muted-foreground text-sm">
        {{ t.loading }}
      </p>
      <Button v-if="info && !error" :loading="pending" @click="accept">
        {{ t.accept }}
      </Button>
      <NuxtLink to="/" class="text-muted-foreground text-center text-xs underline">
        {{ t.home }}
      </NuxtLink>
    </CardContent>
  </Card>
</template>
