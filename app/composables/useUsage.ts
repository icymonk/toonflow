import type { LimitsConfig } from '#shared/config'
import type { UsageDoc } from '#shared/usage'
import { doc, onSnapshot } from 'firebase/firestore'
import { DEFAULT_LIMITS } from '#shared/config'
import { asPlan, effectiveLimitKrw, monthKey, planCapKrw, remainingKrw, usageLevel, usageRatio } from '#shared/usage'

/** AIU-20·21·24: 이번 달 사용량과 한도 (실시간) */
export function useUsage() {
  const { $firestore } = useNuxtApp()
  const auth = useAuthStore()
  const usage = ref<UsageDoc>()
  const limits = ref<LimitsConfig>(DEFAULT_LIMITS)
  const wsLimit = ref<number>()
  const plan = ref(asPlan(undefined))

  const stops: (() => void)[] = []
  watch(() => auth.workspace?.id, (wsId) => {
    stops.splice(0).forEach(s => s())
    if (!wsId) return
    stops.push(
      onSnapshot(doc($firestore, 'workspaces', wsId, 'usage', monthKey()), s => (usage.value = s.data() as UsageDoc | undefined), () => {}),
      onSnapshot(doc($firestore, 'workspaces', wsId), (s) => {
        wsLimit.value = s.get('monthlyLimitKrw') as number | undefined
        plan.value = asPlan(s.get('plan'))
      }, () => {}),
      onSnapshot(doc($firestore, 'config', 'limits'), s => (limits.value = { ...DEFAULT_LIMITS, ...s.data() }), () => {}),
    )
  }, { immediate: true })
  onScopeDispose(() => stops.forEach(s => s()))

  const capKrw = computed(() => planCapKrw(plan.value, limits.value))
  const creditKrw = computed(() => (usage.value as { creditKrw?: number } | undefined)?.creditKrw ?? 0)
  const baseLimitKrw = computed(() => Math.min(wsLimit.value ?? capKrw.value, capKrw.value))
  const limitKrw = computed(() => effectiveLimitKrw({ plan: plan.value, wsLimitKrw: wsLimit.value, limits: limits.value, creditKrw: creditKrw.value }))
  const usedKrw = computed(() => (usage.value?.spentKrw ?? 0) + (usage.value?.reservedKrw ?? 0))
  const ratio = computed(() => usageRatio(limitKrw.value, usage.value))
  const remaining = computed(() => remainingKrw(limitKrw.value, usage.value))
  const level = computed(() => usageLevel(ratio.value))
  return { usage, limits, plan, capKrw, creditKrw, baseLimitKrw, limitKrw, usedKrw, ratio, remaining, level }
}
