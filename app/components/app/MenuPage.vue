<script setup lang="ts">
import { NAV_MAIN } from '~/lib/nav'
import { ko } from '~/locales/ko'

// 아직 기능이 없는 메뉴의 빈 화면 (0-5). 기능이 생기면 각 페이지가 직접 그린다
const props = defineProps<{ menu: keyof typeof ko.empty & string }>()
const item = NAV_MAIN.find(i => i.to === `/${props.menu}`)!
const text = ko.empty[props.menu] as { title: string, body: string }
</script>

<template>
  <div class="p-8">
    <h1 class="text-2xl font-bold">
      {{ item.label }} <span class="text-muted-foreground text-base font-normal">· {{ item.ko }}</span>
    </h1>
    <AppEmptyState :icon="item.icon" :title="text.title" :body="text.body">
      <p class="text-xs">
        {{ ko.empty.soon }}
      </p>
    </AppEmptyState>
  </div>
</template>
