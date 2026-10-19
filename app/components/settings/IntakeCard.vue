<script setup lang="ts">
import type { IntakeConfig, IntakePage } from '#shared/intake'
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { toast } from 'vue-sonner'
import { CONSENT_TEXT, INTAKE_LIMITS, newSlug, parseBanned } from '#shared/intake'
import { canManage } from '#shared/roles'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

// INB-03·04·06 Settings › 제보
const t = ko.settings.intake
const auth = useAuthStore()
const { $firestore } = useNuxtApp()
const manage = computed(() => canManage(auth.role))
const slug = ref('')
const form = reactive({ enabled: false, name: '', intro: '', topics: '', questions: '', images: false, banned: '', consentText: '' })
const saving = ref(false)
const link = computed(() => (slug.value ? `${window.location.origin}/s/${slug.value}` : ''))

onMounted(async () => {
  const ws = auth.workspace!.id
  const cfg = (await getDoc(doc($firestore, 'workspaces', ws, 'config', 'intake'))).data() as IntakeConfig | undefined
  form.name = auth.workspace!.name
  if (!cfg) return
  slug.value = cfg.slug
  form.banned = cfg.bannedWords.join('\n')
  const p = (await getDoc(doc($firestore, 'intake', cfg.slug))).data() as IntakePage | undefined
  if (p) Object.assign(form, { enabled: p.enabled, name: p.name, intro: p.intro, topics: p.topics, questions: p.questions.join('\n'), images: p.images, consentText: p.consentText ?? '' })
})

async function save() {
  saving.value = true
  try {
    const ws = auth.workspace!.id
    const s = slug.value || newSlug()
    const page: IntakePage = {
      workspaceId: ws,
      enabled: form.enabled,
      name: form.name.trim().slice(0, INTAKE_LIMITS.name),
      intro: form.intro.trim().slice(0, INTAKE_LIMITS.intro),
      topics: form.topics.trim().slice(0, INTAKE_LIMITS.topics),
      questions: form.questions.split('\n').map(q => q.trim().slice(0, INTAKE_LIMITS.question)).filter(Boolean).slice(0, INTAKE_LIMITS.questions),
      images: form.images,
      consentText: form.consentText.trim().slice(0, INTAKE_LIMITS.consent),
    }
    const batch = writeBatch($firestore)
    batch.set(doc($firestore, 'intake', s), { ...page, updatedAt: serverTimestamp() })
    batch.set(doc($firestore, 'workspaces', ws, 'config', 'intake'), { slug: s, bannedWords: parseBanned(form.banned), updatedAt: serverTimestamp() })
    await batch.commit()
    slug.value = s
    toast.success(ko.settings.saved)
  }
  catch (e) {
    toast.error(errorMessage(e) ?? ko.errors.unknown)
  }
  finally {
    saving.value = false
  }
}

async function copy() {
  await navigator.clipboard.writeText(link.value)
  toast.success(t.copied)
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ t.title }}</CardTitle>
      <CardDescription>{{ manage ? t.hint : ko.settings.readOnly }}</CardDescription>
    </CardHeader>
    <CardContent>
      <form class="flex flex-col gap-3" @submit.prevent="save">
        <div class="flex flex-col gap-1.5 text-sm">
          <span class="font-medium">{{ t.link }}</span>
          <div v-if="link" class="flex items-center gap-2">
            <code class="bg-muted truncate rounded px-2 py-1 text-xs" data-testid="intake-link">{{ link }}</code>
            <Button type="button" size="sm" variant="outline" @click="copy">
              {{ t.copy }}
            </Button>
            <Button as-child size="sm" variant="ghost">
              <a :href="link" target="_blank" rel="noopener">{{ t.open }}</a>
            </Button>
          </div>
          <p v-else class="text-muted-foreground text-xs">
            {{ t.notSaved }}
          </p>
        </div>
        <label class="flex items-center gap-2 text-sm">
          <input v-model="form.enabled" type="checkbox" :disabled="!manage">
          {{ t.enabled }}
        </label>
        <div class="flex flex-col gap-1.5">
          <Label for="in-name">{{ t.name }}</Label>
          <Input id="in-name" v-model="form.name" :maxlength="INTAKE_LIMITS.name" :disabled="!manage" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="in-intro">{{ t.intro }}</Label>
          <Textarea id="in-intro" v-model="form.intro" rows="2" :maxlength="INTAKE_LIMITS.intro" :disabled="!manage" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="in-topics">{{ t.topics }}</Label>
          <Input id="in-topics" v-model="form.topics" :maxlength="INTAKE_LIMITS.topics" :disabled="!manage" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="in-questions">{{ t.questions }}</Label>
          <Textarea id="in-questions" v-model="form.questions" rows="3" :disabled="!manage" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="in-banned">{{ t.banned }}</Label>
          <Textarea id="in-banned" v-model="form.banned" rows="2" :disabled="!manage" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="in-consent">{{ t.consentText }}</Label>
          <Textarea id="in-consent" v-model="form.consentText" rows="3" :maxlength="INTAKE_LIMITS.consent" :placeholder="CONSENT_TEXT" :disabled="!manage" />
        </div>
        <label class="flex items-center gap-2 text-sm">
          <input v-model="form.images" type="checkbox" :disabled="!manage">
          {{ t.images }}
        </label>
        <p v-if="form.images" class="rounded-md bg-amber-100 px-2 py-1.5 text-xs text-amber-900">
          {{ t.imagesWarn }}
        </p>
        <Button v-if="manage" type="submit" class="self-start" :disabled="saving">
          {{ ko.settings.save }}
        </Button>
      </form>
    </CardContent>
  </Card>
</template>
