<script setup lang="ts">
import { collection, getDocs } from 'firebase/firestore'
import { toast } from 'vue-sonner'
import { errorMessage } from '~/lib/errors'
import { callFn } from '~/lib/functions'
import { ko } from '~/locales/ko'

// ACC-06·13·14: 소유권 넘기기, 워크스페이스 삭제·복구, 계정 삭제
const t = ko.workspaces
const auth = useAuthStore()
const { $firestore, $functions } = useNuxtApp()
const owner = computed(() => auth.role === 'owner')
const admins = ref<{ id: string, name: string }[]>([])
const target = ref('')

onMounted(async () => {
  if (!owner.value || !auth.workspace) return
  const snap = await getDocs(collection($firestore, 'workspaces', auth.workspace.id, 'members'))
  admins.value = snap.docs.filter(d => d.get('role') === 'admin').map(d => ({ id: d.id, name: d.get('displayName') || d.get('email') || d.id }))
})

async function act(fn: () => Promise<unknown>, msg: string) {
  try {
    await fn()
    toast.success(msg)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.unknown)
  }
}
async function transfer() {
  const a = admins.value.find(x => x.id === target.value)
  if (!a || !await confirmDialog(t.transferConfirm(a.name))) return
  return act(async () => {
    await callFn($functions, 'transferOwnership', { workspaceId: auth.workspace!.id, toUid: a.id })
    window.location.assign('/settings')
  }, t.transferred)
}
async function remove() {
  if (!await confirmDialog(t.removeConfirm(auth.workspace!.name))) return
  return act(async () => {
    await callFn($functions, 'deleteWorkspace', { workspaceId: auth.workspace!.id })
    window.location.assign('/')
  }, t.removed)
}
async function deleteAccount() {
  if (!await confirmDialog(t.accountConfirm)) return
  return act(async () => {
    await callFn($functions, 'deleteAccount', {})
    await auth.signOut()
    window.location.assign('/welcome')
  }, t.accountDeleted)
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ t.danger }}</CardTitle>
      <CardDescription>{{ t.dangerHint }}</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-5 text-sm">
      <section v-if="owner" class="flex flex-col gap-2">
        <span class="font-medium">{{ t.transfer }}</span>
        <p class="text-muted-foreground text-xs">{{ t.transferHint }}</p>
        <p v-if="!admins.length" class="text-muted-foreground text-xs">{{ t.noAdmins }}</p>
        <div v-else class="flex gap-2">
          <select v-model="target" class="border-input bg-card h-9 rounded-md border px-3 text-sm" :aria-label="t.pick">
            <option value="">{{ t.pick }}</option>
            <option v-for="a in admins" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
          <Button size="sm" variant="outline" :disabled="!target" @click="transfer">{{ t.transfer }}</Button>
        </div>
      </section>
      <section v-if="owner" class="flex flex-col gap-2">
        <span class="font-medium">{{ t.remove }}</span>
        <p class="text-muted-foreground text-xs">{{ t.removeHint }}</p>
        <Button v-if="auth.workspace?.deleteAt" size="sm" variant="outline" class="self-start" @click="act(() => auth.restoreWorkspace(), t.restored)">{{ t.restore }}</Button>
        <Button v-else size="sm" variant="destructive" class="self-start" @click="remove">{{ t.remove }}</Button>
      </section>
      <section class="flex flex-col gap-2">
        <span class="font-medium">{{ t.account }}</span>
        <p class="text-muted-foreground text-xs">{{ t.accountHint }}</p>
        <Button size="sm" variant="destructive" class="self-start" @click="deleteAccount">{{ t.account }}</Button>
      </section>
    </CardContent>
  </Card>
</template>
