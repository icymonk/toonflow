<script setup lang="ts">
import type { Activity, AdminView } from '#shared/activity'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { canManage } from '#shared/roles'
import { ko } from '~/locales/ko'

// CMN-31 활동 기록 · CMN-54 운영자 열람 기록(소유자·관리자)
const t = ko.activity
const auth = useAuthStore()
const { $firestore } = useNuxtApp()
const items = ref<Activity[]>([])
const views = ref<AdminView[]>([])
const names = ref<Record<string, string>>({})
const stops: (() => void)[] = []
onMounted(() => {
  const ws = auth.workspace!.id
  stops.push(onSnapshot(query(collection($firestore, 'workspaces', ws, 'activity'), orderBy('at', 'desc'), limit(50)), s => (items.value = s.docs.map(d => ({ id: d.id, ...d.data() }) as Activity)), () => {}))
  stops.push(onSnapshot(collection($firestore, 'workspaces', ws, 'members'), s => (names.value = Object.fromEntries(s.docs.map(d => [d.id, d.get('displayName') || d.get('email') || d.id]))), () => {}))
  if (canManage(auth.role)) stops.push(onSnapshot(query(collection($firestore, 'workspaces', ws, 'adminViews'), orderBy('at', 'desc'), limit(20)), s => (views.value = s.docs.map(d => ({ id: d.id, ...d.data() }) as AdminView)), () => {}))
})
onUnmounted(() => stops.forEach(f => f()))
const when = (ts?: { toMillis: () => number }) => (ts ? new Date(ts.toMillis()).toLocaleString('ko-KR') : '')
const who = (uid?: unknown) => (typeof uid === 'string' ? names.value[uid] ?? t.someone : '')
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ t.title }}</CardTitle>
      <CardDescription>{{ t.hint }}</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-3 text-sm">
      <p v-if="!items.length" class="text-muted-foreground text-xs">{{ t.empty }}</p>
      <ul class="flex flex-col gap-1 text-xs">
        <li v-for="a in items" :key="a.id" class="flex gap-2">
          <span class="text-muted-foreground w-36 shrink-0">{{ when(a.at) }}</span>
          <span>{{ who(a.uid) }} · {{ t.actions[a.action] ?? a.action }}<template v-if="a.meta?.target"> · {{ who(a.meta.target) }}</template><template v-if="a.meta?.role"> · {{ ko.members.roles[String(a.meta.role)] }}</template></span>
        </li>
      </ul>
      <section v-if="views.length" class="flex flex-col gap-1 border-t pt-3">
        <span class="font-medium">{{ t.views }}</span>
        <p class="text-muted-foreground text-xs">{{ t.viewsHint }}</p>
        <p v-for="v in views" :key="v.id" class="text-xs">
          <span class="text-muted-foreground">{{ when(v.at) }}</span> · {{ v.email ?? t.operator }} · {{ v.reason }}
        </p>
      </section>
    </CardContent>
  </Card>
</template>
