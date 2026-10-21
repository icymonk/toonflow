import type { AiCheckParams } from '#shared/aicheck'
import type { Bubble, Typeset } from '#shared/render'
import type { Cut } from '#shared/studio'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { callFn } from '~/lib/functions'
import { autoPlace, bubbleSize, cutRects, DEFAULT_TYPESET, pageSize, syncBubbles, titleBand } from '#shared/render'

/** Review: 식자 스타일(REV-04)과 말풍선 배치·편집(REV-01~03) */
export function useReview(s: ReturnType<typeof useStudio>, aspect: Ref<string | undefined>) {
  const { $firestore, $functions } = useNuxtApp()
  const auth = useAuthStore()
  const typeset = ref<Typeset>({ ...DEFAULT_TYPESET })
  const tsRef = () => doc($firestore, 'workspaces', auth.workspace!.id, 'episodes', s.episode.value!.id, 'meta', 'typeset')
  let stop: (() => void) | undefined
  watch(() => [auth.workspace?.id, s.episode.value?.id] as const, ([w, ep]) => {
    stop?.()
    typeset.value = { ...DEFAULT_TYPESET }
    if (!w || !ep) return
    stop = onSnapshot(tsRef(), snap => (typeset.value = { ...DEFAULT_TYPESET, ...(snap.data() as Partial<Typeset> | undefined) }), () => {})
  }, { immediate: true })
  onScopeDispose(() => stop?.())
  const setTypeset = (patch: Partial<Typeset>) => setDoc(tsRef(), { ...typeset.value, ...patch, updatedAt: serverTimestamp() })

  const size = computed(() => pageSize(aspect.value))
  const rectOf = (cut: Cut) => {
    const n = s.cuts.value.filter(c => c.page.id === cut.page.id).length
    return cutRects(cut.page.layout, n, size.value.w, size.value.h, titleBand(cut.page, size.value.h))[cut.indexInPage] ?? { x: 0, y: 0, w: size.value.w, h: size.value.h }
  }
  const bubblesOf = (cut: Cut) => syncBubbles(cut.panel, rectOf(cut), typeset.value.fontSize)
  const find = (panelId: string) => s.cuts.value.find(c => c.panel.id === panelId)

  /** REV-01: force면 이미 놓은 말풍선도 다시 */
  async function place(cuts: Cut[], force: boolean) {
    await Promise.all(cuts.filter(c => c.panel.dialogues.length && (force || !c.panel.bubbles?.length))
      .map(c => s.updatePanel(c.panel.id, { bubbles: autoPlace(c.panel.dialogues, rectOf(c), typeset.value.fontSize) })))
  }
  async function setBubble(panelId: string, dialogueId: string, patch: Partial<Bubble>) {
    const cut = find(panelId)
    if (!cut) return
    await s.updatePanel(panelId, { bubbles: bubblesOf(cut).map(b => (b.dialogueId === dialogueId ? { ...b, ...patch } : b)) })
  }
  /** REV-02: 글을 고치면 콘티 대사도 같이 바뀌고, 말풍선 크기는 글에 맞춘다 */
  async function setText(panelId: string, dialogueId: string, text: string) {
    const cut = find(panelId)
    if (!cut) return
    const dialogues = cut.panel.dialogues.map(d => (d.id === dialogueId ? { ...d, text } : d))
    const bubbles = bubblesOf(cut).map((b) => {
      if (b.dialogueId !== dialogueId) return b
      const { w, h } = bubbleSize(text, b.fontSize, b.shape, rectOf(cut))
      return { ...b, w, h }
    })
    await s.updatePanel(panelId, { dialogues, bubbles })
  }
  /** ILL-43·REV-13: AI 점검 (선택, 비용) */
  const aiCheck = (params: AiCheckParams) => callFn($functions, 'startAiJob', { workspaceId: auth.workspace!.id, type: 'panel.check', target: { episodeId: s.episode.value!.id }, params, idempotencyKey: crypto.randomUUID() })
  return { typeset, setTypeset, size, rectOf, bubblesOf, place, setBubble, setText, aiCheck }
}
