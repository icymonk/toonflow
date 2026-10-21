<script setup lang="ts">
import type { LegalDoc } from '~/locales/legal'
import { LEGAL } from '~/locales/legal'
import { ko } from '~/locales/ko'

const props = defineProps<{ doc: LegalDoc }>()
useHead({ title: `${props.doc.title} · TOONFLOW` })
const links = [
  { to: '/terms', label: ko.legal.terms },
  { to: '/privacy', label: ko.legal.privacy },
  { to: '/data-deletion', label: ko.legal.deletion },
]
</script>

<template>
  <main class="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 p-6">
    <NuxtLink to="/" class="self-start">
      <AppBrandLogo size="sm" />
    </NuxtLink>
    <h1 class="text-2xl font-bold">
      {{ doc.title }}
    </h1>
    <p v-if="doc.intro" class="text-sm leading-relaxed">
      {{ doc.intro }}
    </p>
    <section v-for="s in doc.sections" :key="s.h" class="flex flex-col gap-2">
      <h2 class="text-base font-semibold">
        {{ s.h }}
      </h2>
      <p v-if="s.p" class="text-sm leading-relaxed">
        {{ s.p }}
      </p>
      <ul v-if="s.items" class="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">
        <li v-for="i in s.items" :key="i">
          {{ i }}
        </li>
      </ul>
    </section>
    <p class="text-muted-foreground text-xs">
      시행일 {{ LEGAL.effective }}
    </p>
    <nav class="text-muted-foreground flex flex-wrap gap-4 border-t pt-4 text-xs">
      <NuxtLink v-for="l in links" :key="l.to" :to="l.to" class="underline">
        {{ l.label }}
      </NuxtLink>
    </nav>
  </main>
</template>
