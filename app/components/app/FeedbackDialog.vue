<script setup lang="ts">
import { ko } from '~/locales/ko'

// CMN-60 어느 화면에서든 위쪽 바 버튼으로 피드백 보내기
const open = defineModel<boolean>('open', { required: true })
const route = useRoute()
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ ko.feedback.send }}</DialogTitle>
        <DialogDescription>{{ ko.feedback.hint }}</DialogDescription>
      </DialogHeader>
      <AppFeedbackForm :path="route.fullPath" @sent="open = false" />
      <NuxtLink to="/feedback" class="text-muted-foreground text-xs hover:underline" @click="open = false">
        {{ ko.feedback.mine }} →
      </NuxtLink>
    </DialogContent>
  </Dialog>
</template>
