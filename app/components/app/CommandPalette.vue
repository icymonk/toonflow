<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import { NAV_MAIN, NAV_SETTINGS } from '~/lib/nav'
import { ko } from '~/locales/ko'

// CMN-20 검색 · CMN-21 명령 팔레트: 에피소드·제보·캐릭터·그림체 이름·본문과 메뉴·동작
const emit = defineEmits<{ close: [] }>()
const t = ko.palette
const { episodes } = useStories()
const { list: subs } = useSubmissions()
const { characters, styles } = useLibrary()
const q = ref('')
const active = ref(0)
const input = ref<HTMLInputElement>()
onMounted(() => input.value?.focus())

interface Item { group: string, label: string, sub?: string, to: string }
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')
const items = computed<Item[]>(() => {
  const k = norm(q.value)
  const hit = (...xs: (string | undefined)[]) => !k || xs.some(x => x && norm(x).includes(k))
  const actions: Item[] = [
    { group: t.groups.actions, label: t.actions.newEpisode, to: '/stories' },
    { group: t.groups.actions, label: t.actions.addStory, to: '/inbox' },
    ...[...NAV_MAIN, NAV_SETTINGS, { to: '/trash', label: 'Trash', ko: '휴지통' }].map(n => ({ group: t.groups.go, label: `${n.label} · ${n.ko}`, to: n.to })),
  ].filter(a => hit(a.label))
  if (!k) return actions
  const snippet = (body: string) => {
    const i = body.toLowerCase().indexOf(q.value.trim().toLowerCase())
    return i < 0 ? undefined : `…${body.slice(Math.max(0, i - 15), i + 30)}…`
  }
  return [
    ...actions,
    ...episodes.value.filter(e => hit(e.title)).slice(0, 8).map(e => ({ group: t.groups.episodes, label: e.title, to: `/studio?episode=${e.id}` })),
    ...subs.value.filter(s => !s.deletedAt && hit(s.title, s.body)).slice(0, 8).map(s => ({ group: t.groups.submissions, label: s.title, sub: snippet(s.body), to: `/inbox?id=${s.id}` })),
    ...characters.value.filter(c => hit(c.name, c.intro)).slice(0, 5).map(c => ({ group: t.groups.characters, label: c.name, to: `/characters?id=${c.id}` })),
    ...styles.value.filter(s => hit(s.name)).slice(0, 5).map(s => ({ group: t.groups.styles, label: s.name, to: `/styles?id=${s.id}` })),
  ]
})
watch(q, () => (active.value = 0))
function go(i: Item | undefined) {
  if (!i) return
  emit('close')
  navigateTo(i.to)
}
onKeyStroke(['ArrowDown', 'ArrowUp', 'Enter', 'Escape'], (e) => {
  if (e.key === 'Escape') return emit('close')
  e.preventDefault()
  if (e.key === 'Enter') return go(items.value[active.value])
  const n = items.value.length
  if (n) active.value = (active.value + (e.key === 'ArrowDown' ? 1 : n - 1)) % n
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[15vh]" @click.self="emit('close')">
    <div class="bg-popover w-full max-w-lg overflow-hidden rounded-lg border shadow-lg" role="dialog" :aria-label="t.title">
      <input ref="input" v-model="q" :placeholder="t.placeholder" class="w-full border-b bg-transparent px-4 py-3 text-sm outline-none" :aria-label="t.placeholder">
      <ul class="max-h-80 overflow-y-auto p-1 text-sm">
        <li v-if="!items.length" class="text-muted-foreground px-3 py-4 text-xs">{{ t.empty }}</li>
        <li v-for="(it, i) in items" :key="`${it.group}${it.to}${i}`">
          <p v-if="i === 0 || items[i - 1]!.group !== it.group" class="text-muted-foreground px-3 pt-2 pb-1 text-xs">{{ it.group }}</p>
          <button class="flex w-full flex-col rounded px-3 py-1.5 text-left" :class="i === active ? 'bg-muted' : ''" @mouseenter="active = i" @click="go(it)">
            <span>{{ it.label }}</span>
            <span v-if="it.sub" class="text-muted-foreground truncate text-xs">{{ it.sub }}</span>
          </button>
        </li>
      </ul>
      <p class="text-muted-foreground border-t px-4 py-2 text-xs">{{ t.footer }}</p>
    </div>
  </div>
</template>
