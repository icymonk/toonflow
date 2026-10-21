<script setup lang="ts">
import { toast } from 'vue-sonner'
import { errorMessage } from '~/lib/errors'
import { callFn } from '~/lib/functions'
import { ko } from '~/locales/ko'

// PUB-24: Instagram 로그인 뒤 돌아오는 주소 (Meta 앱의 OAuth 리디렉션 URI)
const t = ko.instagram
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
      const { username } = await callFn($functions, 'connectInstagram', { workspaceId: auth.workspace!.id, code, state })
      toast.success(t.done(username))
    }
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.instagramFailed)
  }
  window.location.replace('/settings')
})
</script>

<template>
  <p class="text-muted-foreground p-8 text-sm" role="status">
    {{ t.connecting }}
  </p>
</template>
