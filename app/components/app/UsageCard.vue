<script setup lang="ts">
import { toast } from 'vue-sonner'
import { canManage } from '#shared/roles'
import { formatKrw } from '#shared/usage'
import { errorMessage } from '~/lib/errors'
import { callFn } from '~/lib/functions'
import { ko } from '~/locales/ko'

const { $functions } = useNuxtApp()
const auth = useAuthStore()
const { limitKrw, usedKrw, ratio, level } = useUsage()
const t = ko.settings
const limitInput = ref<number>()
watchEffect(() => {
  if (limitInput.value === undefined) limitInput.value = limitKrw.value
})
const saving = ref(false)

async function save() {
  const n = Number(limitInput.value)
  if (!Number.isInteger(n) || n < 0) return toast.error(ko.errors.invalidInput)
  saving.value = true
  try {
    await callFn($functions, 'setWorkspaceLimit', { workspaceId: auth.workspace!.id, monthlyLimitKrw: n })
    toast.success(t.saved)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.unknown)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ t.usage }}</CardTitle>
      <CardDescription>{{ t.usageLine(formatKrw(usedKrw), formatKrw(limitKrw)) }}</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <div class="bg-muted h-2 overflow-hidden rounded-full">
        <div class="h-full rounded-full" :class="level === 'ok' ? 'bg-success' : level === 'warn' ? 'bg-warning' : 'bg-destructive'" :style="{ width: `${Math.min(100, ratio * 100)}%` }" />
      </div>
      <p v-if="level !== 'ok'" class="text-sm" :class="level === 'warn' ? 'text-warning' : 'text-destructive'">
        {{ level === 'warn' ? t.usageWarn : t.usageBlocked }}
      </p>
      <form v-if="canManage(auth.role)" class="flex items-end gap-2" @submit.prevent="save">
        <div class="flex flex-col gap-2">
          <Label for="monthlyLimit">{{ t.monthlyLimit }}</Label>
          <Input id="monthlyLimit" v-model.number="limitInput" type="number" min="0" step="1000" class="w-40" />
        </div>
        <Button type="submit" :loading="saving">
          {{ t.save }}
        </Button>
      </form>
    </CardContent>
  </Card>
</template>
