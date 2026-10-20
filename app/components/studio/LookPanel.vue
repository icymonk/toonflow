<script setup lang="ts">
import type { Episode } from '#shared/episodes'
import type { Character, Style } from '#shared/library'
import { ko } from '~/locales/ko'

// 그림체: 컷 > 이번 화 > 작품. 등장 캐릭터: 작품 주요 + 이번 화. 각색·콘티·그림 단계가 같이 써요
const props = defineProps<{ episode: Episode, edit: boolean, styles: Style[], characters: Character[], seriesStyleId: string | null, seriesMainIds: string[], showStyle: boolean, hint: string }>()
const emit = defineEmits<{ settings: [patch: Partial<Episode['settings']>], seriesStyle: [id: string | null], seriesMain: [id: string, on: boolean] }>()
const lk = ko.studio.look
const selectClass = 'border-input bg-card h-9 rounded-md border px-2 text-sm disabled:opacity-50'
function toggleEpisodeChar(id: string, on: boolean) {
  const ids = new Set(props.episode.settings.characterIds ?? [])
  if (on) ids.add(id)
  else ids.delete(id)
  emit('settings', { characterIds: [...ids] })
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <template v-if="showStyle">
      <label class="flex flex-col gap-1 text-xs">{{ lk.seriesStyle }}
        <AppSelect :value="seriesStyleId ?? ''" :class="selectClass" :disabled="!edit" @change="emit('seriesStyle', $event || null)">
          <option value="">{{ lk.none }}</option>
          <option v-for="st in styles" :key="st.id" :value="st.id">{{ st.name }}</option>
        </AppSelect>
      </label>
      <label class="flex flex-col gap-1 text-xs">{{ lk.episodeStyle }}
        <AppSelect :value="episode.settings.styleId ?? ''" :class="selectClass" :disabled="!edit" @change="emit('settings', { styleId: $event || null })">
          <option value="">{{ lk.followSeries }}</option>
          <option v-for="st in styles" :key="st.id" :value="st.id">{{ st.name }}</option>
        </AppSelect>
      </label>
      <p v-if="!styles.length" class="text-muted-foreground text-xs">
        {{ lk.noStyles }} <NuxtLink to="/styles" class="underline">{{ lk.goStyles }}</NuxtLink>
      </p>
    </template>
    <div class="flex items-center justify-between text-xs">
      <span>{{ lk.characters }}</span>
      <span class="text-muted-foreground flex gap-3"><span>{{ lk.main }}</span><span>{{ lk.thisEpisode }}</span></span>
    </div>
    <p v-if="!characters.length" class="text-muted-foreground text-xs">
      {{ lk.noCharacters }} <NuxtLink to="/characters" class="underline">{{ lk.goCharacters }}</NuxtLink>
    </p>
    <div v-for="c in characters" :key="c.id" class="flex items-center justify-between gap-2 text-xs">
      <span class="truncate">{{ c.name }}</span>
      <span class="flex shrink-0 gap-6 pr-3">
        <AppCheck :model-value="seriesMainIds.includes(c.id)" :disabled="!edit" :aria-label="lk.mainOf(c.name)" @change="emit('seriesMain', c.id, $event)" />
        <AppCheck :model-value="episode.settings.characterIds?.includes(c.id) ?? false" :disabled="!edit" :aria-label="lk.episodeOf(c.name)" @change="toggleEpisodeChar(c.id, $event)" />
      </span>
    </div>
    <p class="text-muted-foreground text-xs">
      {{ hint }}
    </p>
  </div>
</template>
