<script setup lang="ts">
import { hasNewReply } from '#shared/feedback'
import { ko } from '~/locales/ko'

// CMN-60·61 피드백 보내기 + 내가 보낸 피드백과 답변
const t = ko.feedback
const route = useRoute()
const router = useRouter()
const { mine, loaded, seen, markSeen } = useFeedback()
const seenBefore = seen.value
onMounted(markSeen)
const openId = computed({
  get: () => String(route.query.id ?? ''),
  set: (v: string) => router.replace({ query: v ? { id: v } : {} }),
})
const when = (ts?: { toMillis: () => number }) => (ts ? new Date(ts.toMillis()).toLocaleString('ko-KR') : '')
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-6 p-4 md:p-8">
    <h1 class="text-xl font-semibold">
      {{ t.title }}
    </h1>
    <Card>
      <CardHeader>
        <CardTitle>{{ t.send }}</CardTitle>
        <CardDescription>{{ t.hint }}</CardDescription>
      </CardHeader>
      <CardContent>
        <AppFeedbackForm path="" @sent="id => (openId = id)" />
      </CardContent>
    </Card>
    <section class="flex flex-col gap-2">
      <h2 class="font-semibold">
        {{ t.mine }}
      </h2>
      <AppListSkeleton v-if="!loaded" />
      <p v-else-if="!mine.length" class="text-muted-foreground text-sm">
        {{ t.empty }}
      </p>
      <div v-for="f in mine" :key="f.id" class="rounded-md border text-sm">
        <button type="button" class="hover:bg-muted flex w-full flex-col gap-1 p-3 text-left" @click="openId = openId === f.id ? '' : f.id">
          <span class="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
            <span class="rounded px-1.5 py-0.5" :class="f.status === 'answered' ? 'bg-primary/15 text-foreground' : 'bg-muted'">{{ t.status[f.status] }}</span>
            {{ t.kinds[f.kind] }} · {{ when(f.createdAt) }}
            <span v-if="hasNewReply(f, seenBefore)" class="text-primary font-medium">{{ t.newReply }}</span>
          </span>
          <span class="line-clamp-2">{{ f.text }}</span>
        </button>
        <div v-if="openId === f.id" class="border-t p-3">
          <AppFeedbackThread :feedback="f" as="user" />
        </div>
      </div>
    </section>
  </div>
</template>
