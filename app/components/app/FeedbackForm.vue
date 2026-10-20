<script setup lang="ts">
import type { FeedbackKind } from '#shared/feedback'
import { toast } from 'vue-sonner'
import { FEEDBACK_KINDS, FEEDBACK_MAX } from '#shared/feedback'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

// CMN-60 피드백 보내기 (위쪽 바 버튼의 창, 피드백 화면)
const props = defineProps<{ path: string }>()
const emit = defineEmits<{ sent: [id: string] }>()
const t = ko.feedback
const send = useFeedbackSend()
const kind = ref<FeedbackKind>('idea')
const text = ref('')
const sending = ref(false)
async function submit() {
  if (!text.value.trim() || sending.value) return
  sending.value = true
  try {
    const ref = await send(kind.value, text.value, props.path)
    text.value = ''
    toast.success(t.sent)
    emit('sent', ref.id)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.unknown)
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <form class="flex flex-col gap-3" @submit.prevent="submit">
    <AppSelect v-model="kind" :aria-label="t.kind" class="border-input bg-card h-9 w-40 rounded-md border px-2 text-sm">
      <option v-for="k in FEEDBACK_KINDS" :key="k" :value="k">
        {{ t.kinds[k] }}
      </option>
    </AppSelect>
    <Textarea v-model="text" rows="5" :maxlength="FEEDBACK_MAX" :placeholder="t.placeholder" :aria-label="t.text" />
    <p v-if="path" class="text-muted-foreground text-xs">
      {{ t.pathNote(path) }}
    </p>
    <Button type="submit" class="self-end" :loading="sending" :disabled="!text.trim()">
      {{ t.submit }}
    </Button>
  </form>
</template>
