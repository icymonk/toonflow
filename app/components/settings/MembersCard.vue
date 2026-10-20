<script setup lang="ts">
import type { Member } from '#shared/members'
import type { Role } from '#shared/roles'
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { toast } from 'vue-sonner'
import { assignable, canChangeMember, INVITE_DAYS } from '#shared/members'
import { canManage } from '#shared/roles'
import { monthKey } from '#shared/usage'
import { errorMessage } from '~/lib/errors'
import { callFn } from '~/lib/functions'
import { ko } from '~/locales/ko'

// ACC-20~23·AIU-22: 멤버 목록·역할·내보내기·나가기·멤버 한도, 초대 링크
interface InviteRow { id: string, role: Role, expiresAt: { toMillis: () => number }, usedCount?: number }
const t = ko.members
const auth = useAuthStore()
const { $firestore, $functions } = useNuxtApp()
const ws = () => auth.workspace!.id
const me = computed(() => auth.user?.uid ?? '')
const actorRole = computed<Role>(() => auth.role ?? 'viewer')
const manage = computed(() => canManage(auth.role))
const members = ref<Member[]>([])
const spent = ref<Record<string, number>>({})
const invites = ref<InviteRow[]>([])
const newRole = ref<Role>('editor')
const newDays = ref<number>(7)
const link = ref('')
const sel = 'border-input bg-card h-7 rounded border px-1 text-xs'
const stops: (() => void)[] = []

onMounted(async () => {
  stops.push(onSnapshot(collection($firestore, 'workspaces', ws(), 'members'), s => (members.value = s.docs.map(d => ({ id: d.id, ...d.data() }) as Member)), () => {}))
  if (manage.value) stops.push(onSnapshot(query(collection($firestore, 'invites'), where('workspaceId', '==', ws())), s => (invites.value = s.docs.map(d => ({ id: d.id, ...d.data() }) as InviteRow)), () => {}))
  const u = await getDoc(doc($firestore, 'workspaces', ws(), 'usage', monthKey())).catch(() => null)
  spent.value = (u?.get('byMember') as Record<string, number> | undefined) ?? {}
})
onUnmounted(() => stops.forEach(f => f()))

const name = (m: Member) => m.displayName || m.email || m.id
const editable = (m: Member) => m.id !== me.value && canChangeMember(actorRole.value, m.role)
const when = (ts?: { toMillis: () => number } | null) => (ts ? new Date(ts.toMillis()).toLocaleDateString('ko-KR') : '-')
async function act(fn: () => Promise<unknown>, msg?: string) {
  try {
    await fn()
    if (msg) toast.success(msg)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.unknown)
  }
}
const setRole = (m: Member, role: string) => act(() => callFn($functions, 'setMemberRole', { workspaceId: ws(), uid: m.id, role: role as 'editor' }), t.saved)
async function remove(m: Member) {
  if (await confirmDialog(t.removeConfirm(name(m)))) return act(() => callFn($functions, 'removeMember', { workspaceId: ws(), uid: m.id }), t.removed)
}
const setLimit = (m: Member, v: string) => act(() => callFn($functions, 'setMemberLimit', { workspaceId: ws(), uid: m.id, monthlyLimitKrw: v.trim() ? Math.round(Number(v)) : null }), t.saved)
async function leave() {
  if (!await confirmDialog(t.leaveConfirm)) return
  return act(async () => {
    await callFn($functions, 'leaveWorkspace', { workspaceId: ws() })
    window.location.assign('/')
  })
}
const createInvite = () => act(async () => {
  const r = await callFn($functions, 'createInvite', { workspaceId: ws(), role: newRole.value as 'editor', days: newDays.value as 7 })
  link.value = `${window.location.origin}/join/${r.token}`
}, t.inviteCreated)
const copy = () => act(() => navigator.clipboard.writeText(link.value), t.copied)
const revoke = (id: string) => act(() => callFn($functions, 'revokeInvite', { workspaceId: ws(), inviteId: id }), t.revoked)
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ t.title }}</CardTitle>
      <CardDescription>{{ t.hint }}</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4 text-sm">
      <table class="w-full text-left text-xs">
        <thead class="text-muted-foreground">
          <tr>
            <th class="py-1 font-normal">{{ t.name }}</th>
            <th class="font-normal">{{ t.role }}</th>
            <th class="font-normal">{{ t.lastActive }}</th>
            <th class="font-normal">{{ t.spent }}</th>
            <th v-if="manage" class="font-normal">{{ t.limit }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in members" :key="m.id" class="border-t">
            <td class="py-1.5">
              <span class="font-medium">{{ name(m) }}</span>
              <span v-if="m.id === me" class="text-muted-foreground"> ({{ t.me }})</span>
              <span v-if="m.email && m.displayName" class="text-muted-foreground block">{{ m.email }}</span>
            </td>
            <td>
              <AppSelect v-if="editable(m)" :value="m.role" :class="sel" :aria-label="t.roleOf(name(m))" @change="setRole(m, $event)">
                <option v-for="r in assignable(actorRole)" :key="r" :value="r">{{ t.roles[r] }}</option>
              </AppSelect>
              <span v-else>{{ t.roles[m.role] }}</span>
            </td>
            <td>{{ when(m.lastActiveAt) }}</td>
            <td>₩{{ (spent[m.id] ?? 0).toLocaleString() }}</td>
            <td v-if="manage">
              <input
                v-if="editable(m)" type="number" min="0" step="1000" :value="m.monthlyLimitKrw ?? ''" :placeholder="t.noLimit" :class="[sel, 'w-24']" :aria-label="t.limitOf(name(m))"
                @change="setLimit(m, ($event.target as HTMLInputElement).value)"
              >
            </td>
            <td class="text-right">
              <Button v-if="editable(m)" size="sm" variant="ghost" class="text-destructive h-7" @click="remove(m)">{{ t.remove }}</Button>
              <Button v-else-if="m.id === me && m.role !== 'owner'" size="sm" variant="ghost" class="h-7" @click="leave">{{ t.leave }}</Button>
            </td>
          </tr>
        </tbody>
      </table>

      <section v-if="manage" class="flex flex-col gap-2 border-t pt-3">
        <span class="font-medium">{{ t.invite }}</span>
        <p class="text-muted-foreground text-xs">{{ t.inviteHint }}</p>
        <div class="flex flex-wrap items-center gap-2">
          <AppSelect v-model="newRole" :class="sel" :aria-label="t.inviteRole">
            <option v-for="r in assignable(actorRole)" :key="r" :value="r">{{ t.roles[r] }}</option>
          </AppSelect>
          <AppSelect v-model.number="newDays" :class="sel" :aria-label="t.inviteDays">
            <option v-for="d in INVITE_DAYS" :key="d" :value="d">{{ t.days(d) }}</option>
          </AppSelect>
          <Button size="sm" @click="createInvite">{{ t.createInvite }}</Button>
        </div>
        <template v-if="link">
          <div class="flex items-center gap-2">
            <Input :model-value="link" readonly class="h-8 text-xs" :aria-label="t.inviteLink" />
            <Button size="sm" variant="outline" @click="copy">{{ t.copy }}</Button>
          </div>
          <p class="text-muted-foreground text-xs">{{ t.linkOnce }}</p>
        </template>
        <ul v-if="invites.length" class="flex flex-col gap-1 text-xs">
          <li v-for="iv in invites" :key="iv.id" class="flex items-center gap-2">
            {{ t.roles[iv.role] }} · {{ t.until(when(iv.expiresAt)) }} · {{ t.used(iv.usedCount ?? 0) }}
            <span v-if="iv.expiresAt.toMillis() < Date.now()" class="text-muted-foreground">{{ t.expired }}</span>
            <button type="button" class="text-destructive ml-auto hover:underline" @click="revoke(iv.id)">{{ t.revoke }}</button>
          </li>
        </ul>
      </section>
    </CardContent>
  </Card>
</template>
