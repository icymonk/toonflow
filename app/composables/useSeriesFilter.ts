import { useLocalStorage } from '@vueuse/core'

/** 캐릭터·그림체·에셋 화면이 같이 쓰는 작품 선택 (마지막 선택 기억, 없는 작품이면 전체) */
export function useSeriesFilter(series: Ref<{ id: string }[]>) {
  const stored = useLocalStorage('toonflow:library:series', '')
  return computed({
    get: () => (series.value.some(s => s.id === stored.value) ? stored.value : ''),
    set: (v: string) => (stored.value = v),
  })
}
