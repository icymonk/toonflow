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

const selectClass = 'border-input bg-card h-9 rounded-md border px-3 text-sm disabled:opacity-50'

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
  <div class="mx-auto flex max-w-2xl flex-col gap-6 p-4 md:p-8">
    <h1 class="text-2xl font-bold">
      {{ t.title }}
    </h1>

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

    <AppUsageCard />

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

    <SettingsInstagramCard />
    <SettingsThreadsCard />
    <SettingsIntakeCard />
    <SettingsMembersCard />
    <SettingsActivityCard />
    <SettingsDangerCard />
  </div>
</template>
