import type { Step } from './episodes'
import { STEPS } from './episodes'

type Ts = { toMillis: () => number }

export const PAGE_LAYOUTS = ['1', '2v', '2h', '3', '4'] as const
export type PageLayout = (typeof PAGE_LAYOUTS)[number]

export interface Page {
  id: string
  layout: PageLayout
  panelIds: string[]
  deletedAt?: Ts | null
}

export type DialogueType = 'speech' | 'thought' | 'whisper' | 'shout' | 'narration' | 'sfx'
export interface Dialogue { id: string, type: DialogueType, speakerId: string | null, text: string }

/** STU-12: 앞 단계가 바뀌어 다시 볼 필요가 있는 결과 */
export type StaleFrom = 'scene' | 'dialogue' | null

export interface Panel {
  id: string
  pageId: string
  scene: string
  characterIds: string[]
  shot: string
  expression: string
  action: string
  outfit: string
  note: string
  dialogues: Dialogue[]
  selectedCandidateId: string | null
  staleFrom: StaleFrom
  deletedAt?: Ts | null
}

export const emptyPanel = (pageId: string): Omit<Panel, 'id'> => ({
  pageId, scene: '', characterIds: [], shot: '', expression: '', action: '', outfit: '', note: '',
  dialogues: [], selectedCandidateId: null, staleFrom: null, deletedAt: null,
})

export interface Cut { panel: Panel, page: Page, pageIndex: number, indexInPage: number, number: number }

/** 장 순서(pageOrder) → 장 안 배치(panelIds) 순으로 펼친 컷 목록. 지운 장·컷은 뺀다 */
export function orderCuts(pageOrder: string[], pages: Page[], panels: Panel[]): Cut[] {
  const pageMap = new Map(pages.filter(p => !p.deletedAt).map(p => [p.id, p]))
  const panelMap = new Map(panels.filter(p => !p.deletedAt).map(p => [p.id, p]))
  const cuts: Cut[] = []
  pageOrder.map(id => pageMap.get(id)).filter((p): p is Page => !!p).forEach((page, pageIndex) => {
    page.panelIds.map(id => panelMap.get(id)).filter((p): p is Panel => !!p).forEach((panel, indexInPage) => {
      cuts.push({ panel, page, pageIndex, indexInPage, number: cuts.length + 1 })
    })
  })
  return cuts
}

export interface StudioState {
  activeStoryVersionId: string | null
  status: 'active' | 'done' | 'published'
  cuts: Cut[]
}

/** overview 7절: 다음 단계로 넘어가는 조건. 남은 개수가 0이면 그 단계는 완료(✓) */
export function remaining(step: Step, s: StudioState): number {
  switch (step) {
    case 'story': return s.activeStoryVersionId ? 0 : 1
    case 'storyboard': return s.cuts.length === 0 ? 1 : s.cuts.filter(c => !c.panel.scene.trim()).length
    case 'illustrate': return s.cuts.length === 0 ? 1 : s.cuts.filter(c => !c.panel.selectedCandidateId).length
    case 'review': return s.status === 'active' ? 1 : 0
    case 'export': return s.status === 'published' ? 0 : 1
  }
}

/** STU-11: 지금 단계 앞의 단계 중 조건을 못 채운 첫 단계 */
export function firstUnmetBefore(step: Step, s: StudioState): Step | null {
  return STEPS.slice(0, STEPS.indexOf(step)).find(st => remaining(st, s) > 0) ?? null
}

/** STU-30·31: 컷 하나를 앞뒤로 옮긴 뒤 장별 panelIds. 장 경계를 넘으면 옆 장 끝/처음으로 */
export function movedPanelIds(cuts: Cut[], panelId: string, dir: -1 | 1): Record<string, string[]> | null {
  const i = cuts.findIndex(c => c.panel.id === panelId)
  if (i < 0) return null
  const cur = cuts[i]!
  const ids = (pageId: string) => [...cuts.find(c => c.page.id === pageId)!.page.panelIds]
  const neighbor = cuts[i + dir]
  if (!neighbor) return null
  if (neighbor.page.id === cur.page.id) {
    const list = ids(cur.page.id)
    const a = list.indexOf(panelId)
    const b = list.indexOf(neighbor.panel.id)
    ;[list[a], list[b]] = [list[b]!, list[a]!]
    return { [cur.page.id]: list }
  }
  const from = ids(cur.page.id).filter(id => id !== panelId)
  const to = ids(neighbor.page.id)
  if (dir === 1) to.unshift(panelId)
  else to.push(panelId)
  return { [cur.page.id]: from, [neighbor.page.id]: to }
}

/** STU-21: 실행 취소·다시 실행 스택 */
export interface Command { label: string, undo: () => Promise<unknown> | unknown, redo: () => Promise<unknown> | unknown }
export function createHistory(limit = 50) {
  const done: Command[] = []
  const undone: Command[] = []
  return {
    push(c: Command) {
      done.push(c)
      if (done.length > limit) done.shift()
      undone.length = 0
    },
    async undo() {
      const c = done.pop()
      if (!c) return null
      await c.undo()
      undone.push(c)
      return c
    },
    async redo() {
      const c = undone.pop()
      if (!c) return null
      await c.redo()
      done.push(c)
      return c
    },
    get canUndo() { return done.length > 0 },
    get canRedo() { return undone.length > 0 },
  }
}
