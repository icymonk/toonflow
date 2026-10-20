import { useLocalStorage } from '@vueuse/core'

/** EPI-05 지금 작업 중인 작품: 사이드바·Stories·제작실·캐릭터·그림체·에셋·Home이 같이 써요 (마지막 선택 기억, 없는 작품이면 전체) */
export function useSeriesFilter(series: Ref<{ id: string }[]>) {
  const stored = useLocalStorage('toonflow:library:series', '')
  return computed({
    get: () => (series.value.some(s => s.id === stored.value) ? stored.value : ''),
    set: (v: string) => (stored.value = v),
  })
}
