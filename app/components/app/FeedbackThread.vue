<script setup lang="ts">
import type { Feedback, FeedbackStatus } from '#shared/feedback'
import { toast } from 'vue-sonner'
import { FEEDBACK_MAX, FEEDBACK_STATUSES } from '#shared/feedback'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

// CMN-61·63 피드백 원문 + 답변·댓글. 운영자는 답변과 상태 바꾸기
const props = defineProps<{ feedback: Feedback, as: 'user' | 'admin' }>()
const emit = defineEmits<{ changed: [] }>()
const t = ko.feedback
const { replies, reply, setStatus } = useFeedbackThread(() => props.feedback.id)
const draft = ref('')
const sending = ref(false)
const when = (ts?: { toMillis: () => number }) => (ts ? new Date(ts.toMillis()).toLocaleString('ko-KR') : '')
const names = computed(() => (props.as === 'admin' ? t.byAdminView : t.by))
async function run(fn: () => Promise<unknown>) {
  sending.value = true
  try {
    await fn()
    emit('changed')
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.unknown)
  }
  finally {
    sending.value = false
  }
}
const send = () => draft.value.trim() && run(async () => {
  await reply(props.feedback.id, draft.value, props.as)
  draft.value = ''
})
const changeStatus = (s: unknown) => run(() => setStatus(props.feedback.id, s as FeedbackStatus))
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="rounded-md border p-3 text-sm">
      <p class="text-muted-foreground mb-1 text-xs">
        {{ t.kinds[feedback.kind] }} · {{ when(feedback.createdAt) }}<template v-if="feedback.path">
          · {{ t.pathNote(feedback.path) }}
        </template>
      </p>
      <p class="whitespace-pre-wrap">
        {{ feedback.text }}
      </p>
    </div>
    <div v-for="r in replies" :key="r.id" class="rounded-md p-3 text-sm" :class="r.by === 'admin' ? 'bg-primary/10' : 'bg-muted'">
      <p class="text-muted-foreground mb-1 text-xs">
        {{ names[r.by] }} · {{ when(r.createdAt) }}
      </p>
      <p class="whitespace-pre-wrap">
        {{ r.text }}
      </p>
    </div>
    <form class="flex flex-col gap-2" @submit.prevent="send">
      <Textarea v-model="draft" rows="3" :maxlength="FEEDBACK_MAX" :placeholder="as === 'admin' ? t.adminReply : t.userReply" :aria-label="as === 'admin' ? t.adminReply : t.userReply" />
      <div class="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" :loading="sending" :disabled="!draft.trim()">
          {{ as === 'admin' ? t.adminReplySend : t.userReplySend }}
        </Button>
        <AppSelect v-if="as === 'admin'" :value="feedback.status" :aria-label="t.statusLabel" class="border-input bg-card h-8 w-28 rounded-md border px-2 text-xs" @change="changeStatus">
          <option v-for="s in FEEDBACK_STATUSES" :key="s" :value="s">
            {{ t.status[s] }}
          </option>
        </AppSelect>
      </div>
    </form>
  </div>
</template>
