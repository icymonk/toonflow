<script setup lang="ts">
import { toast } from 'vue-sonner'
import { errorMessage } from '~/lib/errors'
import { callFn } from '~/lib/functions'
import { ko } from '~/locales/ko'

// CMN-41 랜딩 · 대기 명단 신청
definePageMeta({ layout: false })
const t = ko.welcome
const { $functions } = useNuxtApp()
const form = reactive({ email: '', name: '', handle: '', note: '', agree: false, website: '' })
const pending = ref(false)
const done = ref(false)

async function join() {
  if (!form.agree) return toast.warning(t.needAgree)
  pending.value = true
  try {
    await callFn($functions, 'joinWaitlist', { ...form, agree: true })
    done.value = true
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.unknown)
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="bg-background min-h-svh">
    <header class="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
      <AppBrandLogo />
      <Button as-child size="sm" variant="outline">
        <NuxtLink to="/login">{{ t.login }}</NuxtLink>
      </Button>
    </header>

    <section class="mx-auto flex max-w-5xl flex-col items-start gap-5 px-6 pt-10 pb-16">
      <p class="text-primary text-sm font-semibold tracking-wide">{{ ko.brand.slogan }}</p>
      <h1 class="text-4xl leading-tight font-bold sm:text-5xl">{{ ko.brand.message }}</h1>
      <p class="text-muted-foreground max-w-2xl text-lg">{{ t.sub }}</p>
      <Button as-child size="lg">
        <a href="#waitlist">{{ t.cta }}</a>
      </Button>
    </section>

    <section class="bg-muted/40 border-y">
      <div class="mx-auto max-w-5xl px-6 py-14">
        <h2 class="mb-6 text-2xl font-bold">{{ t.flowTitle }}</h2>
        <ol class="grid gap-4 sm:grid-cols-5">
          <li v-for="(s, i) in t.flow" :key="s.name" class="bg-card flex flex-col gap-1.5 rounded-lg border p-4">
            <span class="text-primary text-xs font-semibold">{{ i + 1 }} · {{ s.name }}</span>
            <span class="font-medium">{{ s.title }}</span>
            <span class="text-muted-foreground text-sm">{{ s.desc }}</span>
          </li>
        </ol>
      </div>
    </section>

    <section class="mx-auto max-w-5xl px-6 py-14">
      <h2 class="mb-2 text-2xl font-bold">{{ t.exampleTitle }}</h2>
      <p class="text-muted-foreground mb-6 text-sm">{{ t.exampleHint }}</p>
      <div class="grid gap-4 sm:grid-cols-3">
        <figure v-for="(ex, i) in t.examples" :key="i" class="bg-card overflow-hidden rounded-lg border">
          <div class="relative aspect-[4/5] bg-gradient-to-br" :class="['from-orange-100 to-rose-200', 'from-sky-100 to-indigo-200', 'from-amber-100 to-lime-200'][i]">
            <span class="absolute top-4 left-4 max-w-[70%] rounded-2xl border-2 border-neutral-900 bg-white px-3 py-2 text-sm font-medium">{{ ex.line }}</span>
            <span class="absolute right-4 bottom-4 text-3xl font-black text-neutral-900/80">{{ ex.sfx }}</span>
          </div>
          <figcaption class="p-3 text-sm">
            <span class="font-medium">{{ ex.title }}</span>
            <span class="text-muted-foreground block text-xs">{{ ex.from }}</span>
          </figcaption>
        </figure>
      </div>
    </section>

    <section id="waitlist" class="bg-muted/40 border-t">
      <div class="mx-auto flex max-w-xl flex-col gap-4 px-6 py-14">
        <h2 class="text-2xl font-bold">{{ t.waitTitle }}</h2>
        <p class="text-muted-foreground text-sm">{{ t.waitHint }}</p>
        <p v-if="done" class="bg-card rounded-md border px-4 py-3 text-sm" role="status">{{ t.done }}</p>
        <form v-else class="flex flex-col gap-3" @submit.prevent="join">
          <Label for="wl-name">{{ t.name }}</Label>
          <Input id="wl-name" v-model="form.name" required maxlength="40" autocomplete="nickname" />
          <Label for="wl-email">{{ t.email }}</Label>
          <Input id="wl-email" v-model="form.email" type="email" required autocomplete="email" :placeholder="ko.login.emailPlaceholder" />
          <Label for="wl-handle">{{ t.handle }}</Label>
          <Input id="wl-handle" v-model="form.handle" maxlength="60" placeholder="@toonflow" />
          <Label for="wl-note">{{ t.note }}</Label>
          <Textarea id="wl-note" v-model="form.note" rows="3" maxlength="500" />
          <input v-model="form.website" type="text" name="website" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true">
          <label class="flex items-start gap-2 text-sm">
            <AppCheck v-model="form.agree" class="mt-1" />
            <span>{{ t.agree }}</span>
          </label>
          <Button type="submit" :disabled="pending || !form.email || !form.name">{{ t.submit }}</Button>
        </form>
      </div>
    </section>

    <footer class="text-muted-foreground mx-auto max-w-5xl px-6 py-8 text-xs">
      © TOONFLOW
    </footer>
  </div>
</template>
