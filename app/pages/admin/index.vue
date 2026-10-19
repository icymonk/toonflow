<script setup lang="ts">
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { toast } from 'vue-sonner'
import { DEFAULT_LIMITS, DEFAULT_MODELS, limitsConfig, modelsConfig, parseEmails } from '#shared/config'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

// CMN-50: 운영자 설정. 규칙이 admin 클레임으로 다시 막는다
const { $auth, $firestore } = useNuxtApp()
const t = ko.admin
const isAdmin = ref<boolean | null>(null)
const emails = ref('')
const limits = reactive({ ...DEFAULT_LIMITS })
const modelsText = ref('')

onMounted(async () => {
  const token = await $auth.currentUser?.getIdTokenResult()
  isAdmin.value = token?.claims.admin === true
  if (!isAdmin.value) return
  const [access, lim, models] = await Promise.all(['access', 'limits', 'models'].map(id => getDoc(doc($firestore, 'config', id))))
  emails.value = ((access!.get('allowedEmails') as string[] | undefined) ?? []).join('\n')
  Object.assign(limits, { ...DEFAULT_LIMITS, ...lim!.data() })
  modelsText.value = JSON.stringify({ ...DEFAULT_MODELS, ...models!.data() }, null, 2)
})

async function save(id: string, data: Record<string, unknown>) {
  try {
    await setDoc(doc($firestore, 'config', id), data)
    toast.success(t.saved)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.unknown)
  }
}

const saveAccess = () => save('access', { allowedEmails: parseEmails(emails.value) })

function saveLimits() {
  const parsed = limitsConfig.safeParse({ ...limits })
  if (!parsed.success) return toast.error(t.invalid)
  return save('limits', parsed.data)
}

function saveModels() {
  let json: unknown
  try {
    json = JSON.parse(modelsText.value)
  }
  catch {
    return toast.error(t.invalid)
  }
  const parsed = modelsConfig.safeParse(json)
  if (!parsed.success) return toast.error(t.invalid)
  return save('models', parsed.data)
}
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-6 p-8">
    <h1 class="text-2xl font-bold">
      {{ t.title }}
    </h1>
    <p v-if="isAdmin === false" class="text-muted-foreground">
      {{ t.notAdmin }}
    </p>
    <template v-else-if="isAdmin">
      <Card>
        <CardHeader>
          <CardTitle>{{ t.access }}</CardTitle>
          <CardDescription>{{ t.accessHint }}</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-2">
          <Textarea v-model="emails" rows="5" />
          <Button class="self-start" @click="saveAccess">
            {{ t.save }}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{{ t.limits }}</CardTitle>
        </CardHeader>
        <CardContent class="grid grid-cols-3 gap-4">
          <div class="flex flex-col gap-2">
            <Label for="ml">{{ t.monthlyLimit }}</Label>
            <Input id="ml" v-model.number="limits.monthlyLimitKrw" type="number" min="0" step="1000" />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="co">{{ t.confirmOver }}</Label>
            <Input id="co" v-model.number="limits.confirmOverKrw" type="number" min="0" step="500" />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="mc">{{ t.maxConcurrent }}</Label>
            <Input id="mc" v-model.number="limits.maxConcurrentJobs" type="number" min="1" max="20" />
          </div>
          <Button class="col-span-3 self-start justify-self-start" @click="saveLimits">
            {{ t.save }}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{{ t.models }}</CardTitle>
          <CardDescription>{{ t.modelsHint }}</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-2">
          <Textarea v-model="modelsText" rows="12" class="font-mono text-xs" />
          <Button class="self-start" @click="saveModels">
            {{ t.save }}
          </Button>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
