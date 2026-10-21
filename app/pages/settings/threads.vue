<script setup lang="ts">
import { toast } from 'vue-sonner'
import { errorMessage } from '~/lib/errors'
import { callFn } from '~/lib/functions'
import { ko } from '~/locales/ko'

// PUB-25: Threads 로그인 뒤 돌아오는 주소 (Meta 앱의 Threads 리디렉션 콜백 URL)
const t = ko.threads
const route = useRoute()
const auth = useAuthStore()
const { $functions } = useNuxtApp()

onMounted(async () => {
  const code = String(route.query.code ?? '')
  const state = String(route.query.state ?? '')
  try {
    if (!code) {
      toast.warning(t.denied)
    }
    else {
      const { username } = await callFn($functions, 'connectThreads', { workspaceId: auth.workspace!.id, code, state })
      toast.success(t.done(username))
    }
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.threadsFailed)
  }
  window.location.replace('/settings')
})
</script>

<template>
  <p class="text-muted-foreground p-8 text-sm" role="status">
    {{ t.connecting }}
  </p>
</template>
