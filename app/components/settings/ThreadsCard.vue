<script setup lang="ts">
import { toast } from 'vue-sonner'
import { canManage } from '#shared/roles'
import { errorMessage } from '~/lib/errors'
import { callFn } from '~/lib/functions'
import { ko } from '~/locales/ko'

// PUB-25: Threads 계정 연결·해제
const t = ko.threads
const auth = useAuthStore()
const { $functions } = useNuxtApp()
const manage = computed(() => canManage(auth.role))
const info = computed(() => auth.workspace?.threads ?? null)
const busy = ref(false)

async function act(fn: () => Promise<void>) {
  busy.value = true
  try { await fn() }
  catch (error) { toast.error(errorMessage(error) ?? ko.errors.unknown) }
  finally { busy.value = false }
}
const connect = () => act(async () => {
  const { url } = await callFn($functions, 'threadsAuthUrl', { workspaceId: auth.workspace!.id })
  window.location.assign(url)
})
const disconnect = () => act(async () => {
  if (!await confirmDialog(t.disconnectConfirm)) return
  await callFn($functions, 'disconnectThreads', { workspaceId: auth.workspace!.id })
  auth.workspace!.threads = null
  toast.success(t.disconnected)
})
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ t.title }}</CardTitle>
      <CardDescription>{{ manage ? t.hint : t.manageOnly }}</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-wrap items-center gap-3">
      <template v-if="info">
        <div class="flex flex-col text-sm">
          <span class="font-medium">{{ t.connected(info.username) }}</span>
          <span class="text-muted-foreground text-xs">{{ t.expires(new Date(info.expiresAt).toLocaleDateString('ko-KR')) }}</span>
        </div>
        <Button v-if="manage" variant="outline" size="sm" :disabled="busy" @click="disconnect">
          {{ t.disconnect }}
        </Button>
      </template>
      <Button v-else-if="manage" :loading="busy" :disabled="busy" @click="connect">
        {{ t.connect }}
      </Button>
    </CardContent>
  </Card>
</template>
