<script setup lang="ts">
import { toast } from 'vue-sonner'
import { canManage } from '#shared/roles'
import { workspaceSettingsInput } from '#shared/workspace'
import { errorMessage } from '~/lib/errors'
import { ko } from '~/locales/ko'

const auth = useAuthStore()
const t = ko.settings

const displayName = ref(auth.profile?.displayName ?? '')
const wsName = ref(auth.workspace?.name ?? '')
const defaults = reactive({ ...auth.workspace!.defaults })
const manage = computed(() => canManage(auth.role))
const saving = ref<'profile' | 'workspace' | null>(null)

const selectClass = 'border-input bg-card h-8 w-full rounded-lg border px-2.5 text-sm disabled:opacity-50'

// 왼쪽(모바일은 위) 항목 목록: 누르면 그 카드로 스크롤, 스크롤하면 지금 보는 항목 표시
const sections = [
  { id: 'profile', label: t.profile },
  { id: 'usage', label: t.usage },
  { id: 'workspace', label: t.workspace },
  { id: 'instagram', label: ko.instagram.title },
  { id: 'threads', label: ko.threads.title },
  { id: 'intake', label: t.intake.title },
  { id: 'members', label: ko.members.title },
  { id: 'activity', label: ko.activity.title },
  { id: 'danger', label: ko.workspaces.danger },
]
const active = ref('profile')
const go = (id: string) => {
  active.value = id
  document.getElementById(`set-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
let io: IntersectionObserver | undefined
onMounted(() => {
  io = new IntersectionObserver((es) => {
    const hit = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
    if (hit) active.value = hit.target.id.slice(4)
  }, { rootMargin: '-120px 0px -60% 0px' })
  for (const x of sections) {
    const el = document.getElementById(`set-${x.id}`)
    if (el) io.observe(el)
  }
})
onBeforeUnmount(() => io?.disconnect())

async function run(kind: 'profile' | 'workspace', fn: () => Promise<void>) {
  saving.value = kind
  try {
    await fn()
    toast.success(t.saved)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? ko.errors.unknown)
  }
  finally {
    saving.value = null
  }
}

function saveProfile() {
  const name = displayName.value.trim()
  if (!name || name.length > 30) return toast.error(ko.errors.invalidInput)
  return run('profile', () => auth.saveDisplayName(name))
}

function saveWorkspace() {
  const parsed = workspaceSettingsInput.safeParse({ name: wsName.value, defaults: { ...defaults } })
  if (!parsed.success) return toast.error(ko.errors.invalidInput)
  return run('workspace', () => auth.saveWorkspace(parsed.data))
}
</script>

<template>
  <div class="mx-auto flex max-w-4xl gap-8 p-4 md:p-8">
    <nav class="sticky top-20 hidden h-fit w-44 shrink-0 flex-col gap-0.5 md:flex" :aria-label="t.sections">
      <button
        v-for="x in sections" :key="x.id" type="button" class="rounded-md px-3 py-1.5 text-left text-sm"
        :class="active === x.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'" :aria-current="active === x.id ? 'true' : undefined" @click="go(x.id)"
      >
        {{ x.label }}
      </button>
    </nav>
    <div class="flex min-w-0 flex-1 flex-col gap-6">
    <h1 class="text-2xl font-bold">
      {{ t.title }}
    </h1>
    <nav class="bg-background/95 sticky top-14 z-10 -mx-4 -mt-3 flex gap-1 overflow-x-auto border-b px-4 py-2 md:hidden" :aria-label="t.sections">
      <button
        v-for="x in sections" :key="x.id" type="button" class="shrink-0 rounded-full px-3 py-1 text-xs"
        :class="active === x.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'" :aria-current="active === x.id ? 'true' : undefined" @click="go(x.id)"
      >
        {{ x.label }}
      </button>
    </nav>

    <section id="set-profile" class="scroll-mt-32 md:scroll-mt-20">
    <Card>
      <CardHeader>
        <CardTitle>{{ t.profile }}</CardTitle>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-2" @submit.prevent="saveProfile">
          <Label for="displayName">{{ t.displayName }}</Label>
          <Input id="displayName" v-model="displayName" maxlength="30" required />
          <Button type="submit" class="self-start" :disabled="saving !== null">
            {{ t.save }}
          </Button>
        </form>
      </CardContent>
    </Card>

    </section>
    <section id="set-usage" class="flex scroll-mt-32 flex-col gap-6 md:scroll-mt-20"><AppUsageCard /><SettingsUsageDetailCard /></section>
    <section id="set-workspace" class="scroll-mt-32 md:scroll-mt-20">

    <Card>
      <CardHeader>
        <CardTitle>{{ t.workspace }}</CardTitle>
        <CardDescription v-if="!manage">
          {{ t.readOnly }}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-4" @submit.prevent="saveWorkspace">
          <div class="flex flex-col gap-2">
            <Label for="wsName">{{ t.workspaceName }}</Label>
            <Input id="wsName" v-model="wsName" maxlength="40" required :disabled="!manage" />
          </div>
          <div>
            <p class="text-sm font-medium">
              {{ t.defaults }}
            </p>
            <p class="text-muted-foreground text-sm">
              {{ t.defaultsHint }}
            </p>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-2">
              <Label for="aspect">{{ t.aspect }}</Label>
              <AppSelect id="aspect" v-model="defaults.aspect" :class="selectClass" :disabled="!manage">
                <option value="4:5">4:5 (1080×1350)</option>
                <option value="1:1">1:1</option>
                <option value="3:4">3:4</option>
              </AppSelect>
            </div>
            <div class="flex flex-col gap-2">
              <Label for="pageCount">{{ t.pageCount }}</Label>
              <Input id="pageCount" v-model.number="defaults.pageCount" type="number" min="1" max="20" :disabled="!manage" />
            </div>
            <div class="flex flex-col gap-2">
              <Label for="candidateCount">{{ t.candidateCount }}</Label>
              <AppSelect id="candidateCount" v-model.number="defaults.candidateCount" :class="selectClass" :disabled="!manage">
                <option v-for="n in [1, 2, 3, 4]" :key="n" :value="n">
                  {{ n }}
                </option>
              </AppSelect>
            </div>
            <div class="flex flex-col gap-2">
              <Label for="storyDraftCount">{{ t.storyDraftCount }}</Label>
              <AppSelect id="storyDraftCount" v-model.number="defaults.storyDraftCount" :class="selectClass" :disabled="!manage">
                <option v-for="n in [1, 2, 3]" :key="n" :value="n">
                  {{ n }}
                </option>
              </AppSelect>
            </div>
            <div class="flex flex-col gap-2">
              <Label for="narrator">{{ t.narrator }}</Label>
              <AppSelect id="narrator" v-model="defaults.narrator" :class="selectClass" :disabled="!manage">
                <option value="first">
                  {{ t.narratorFirst }}
                </option>
                <option value="third">
                  {{ t.narratorThird }}
                </option>
              </AppSelect>
            </div>
          </div>
          <Button v-if="manage" type="submit" class="self-start" :disabled="saving !== null">
            {{ t.save }}
          </Button>
        </form>
      </CardContent>
    </Card>

    </section>
    <section id="set-instagram" class="scroll-mt-32 md:scroll-mt-20"><SettingsInstagramCard /></section>
    <section id="set-threads" class="scroll-mt-32 md:scroll-mt-20"><SettingsThreadsCard /></section>
    <section id="set-intake" class="scroll-mt-32 md:scroll-mt-20"><SettingsIntakeCard /></section>
    <section id="set-members" class="scroll-mt-32 md:scroll-mt-20"><SettingsMembersCard /></section>
    <section id="set-activity" class="scroll-mt-32 md:scroll-mt-20"><SettingsActivityCard /></section>
    <section id="set-danger" class="scroll-mt-32 md:scroll-mt-20"><SettingsDangerCard /></section>
    </div>
  </div>
</template>
