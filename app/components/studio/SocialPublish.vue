<script setup lang="ts">
import type { SocialPlatform } from '#shared/social'
import { useLocalStorage } from '@vueuse/core'
import { SOCIAL_NAMES as names } from '#shared/social'
import { ko } from '~/locales/ko'

// PUB-24·25: 연결된 곳을 골라 한 번에 게시. 진행은 서버 작업 문서(socialPosts) 기준
const props = defineProps<{
  accounts: Partial<Record<SocialPlatform, string>>
  states: Partial<Record<SocialPlatform, 'posting' | 'failed' | null>>
  progress: Partial<Record<SocialPlatform, { ratio: number, step: string }>>
  posted: Partial<Record<SocialPlatform, { at: string, url: string }>>
  disabled: boolean
}>()
const emit = defineEmits<{ post: [platforms: SocialPlatform[]] }>()
const t = ko.studio.publish
const picked = useLocalStorage<SocialPlatform[]>('toonflow:socialTargets', ['instagram', 'threads'])
const connected = computed(() => (Object.keys(props.accounts) as SocialPlatform[]).filter(p => props.accounts[p]))
// 이미 게시한 곳은 기본 해제. 직접 고르면 다시 게시(새 게시물)
const again = ref<SocialPlatform[]>([])
watch(() => JSON.stringify(props.posted), () => (again.value = []))
const isPicked = (p: SocialPlatform) => (props.posted[p] ? again.value.includes(p) : picked.value.includes(p))
const chosen = computed(() => connected.value.filter(p => isPicked(p) && props.states[p] !== 'posting'))
const flip = (list: SocialPlatform[], p: SocialPlatform) => (list.includes(p) ? list.filter(x => x !== p) : [...list, p])
function toggle(p: SocialPlatform) {
  if (props.posted[p]) again.value = flip(again.value, p)
  else picked.value = flip(picked.value, p)
}
</script>

<template>
  <section v-if="connected.length" class="flex flex-col gap-1.5">
    <span class="text-xs font-medium">{{ t.socialTitle }}</span>
    <div v-for="p in connected" :key="p" class="flex flex-col gap-1">
      <label class="flex items-center gap-2 text-xs">
        <AppCheck :model-value="isPicked(p)" :disabled="states[p] === 'posting'" @change="toggle(p)" />
        {{ names[p] }} <span class="text-muted-foreground">@{{ accounts[p] }}</span>
        <span v-if="posted[p]" class="ml-auto text-emerald-700">{{ t.postedBadge(posted[p]!.at) }}</span>
      </label>
      <template v-if="states[p] === 'posting'">
        <div class="bg-muted h-1.5 overflow-hidden rounded-full" role="progressbar" :aria-valuenow="Math.round((progress[p]?.ratio ?? 0) * 100)" aria-valuemin="0" aria-valuemax="100">
          <div class="bg-primary h-full transition-all" :style="{ width: `${Math.max(4, Math.round((progress[p]?.ratio ?? 0) * 100))}%` }" />
        </div>
        <span class="text-muted-foreground text-xs" role="status">{{ progress[p]?.step || t.socialQueued }}</span>
      </template>
      <p v-else-if="states[p] === 'failed'" class="text-destructive text-xs" role="alert">{{ t.socialFailed(names[p]) }}</p>
    </div>
    <Button size="sm" type="button" :disabled="disabled || !chosen.length" @click="emit('post', chosen)">{{ t.socialPost(chosen.length) }}</Button>
  </section>
  <NuxtLink v-else to="/settings" class="text-muted-foreground text-xs underline">{{ t.igConnect }}</NuxtLink>
</template>
