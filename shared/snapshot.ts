import type { Page, Panel } from './studio'

/** STU-23 스냅숏: 에피소드 장·컷 전체를 문서 하나에 복사해 둔다 */
export const SNAPSHOT_MAX_PANELS = 80
export const SNAPSHOT_NAME_MAX = 40

const PAGE_KEYS = ['layout', 'panelIds', 'title'] as const
const PANEL_KEYS = ['pageId', 'scene', 'place', 'mood', 'characterNames', 'characterIds', 'shot', 'expression', 'action', 'outfit', 'note', 'dialogues', 'selectedCandidateId', 'crop', 'bubbles', 'refImage', 'styleId', 'staleFrom'] as const

export type SnapPage = Pick<Page, 'id' | (typeof PAGE_KEYS)[number]>
export type SnapPanel = Pick<Panel, 'id' | 'pageId' | 'scene' | 'dialogues' | 'selectedCandidateId'> & Partial<Omit<Panel, 'id' | 'deletedAt'>>

export interface SnapshotData {
  title: string
  pageOrder: string[]
  activeStoryVersionId: string | null
  pages: SnapPage[]
  panels: SnapPanel[]
}
export interface Snapshot extends SnapshotData {
  id: string
  name: string
  createdBy: string
  createdAt?: { toMillis: () => number } | null
}

function pick<T extends object>(src: T, keys: readonly string[]) {
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    const v = (src as Record<string, unknown>)[k]
    if (v !== undefined) out[k] = v
  }
  return out
}

interface EpisodeLike { title: string, pageOrder?: string[], activeStoryVersionId?: string | null }

export function takeSnapshot(ep: EpisodeLike, pages: Page[], panels: Panel[]): SnapshotData {
  return {
    title: ep.title,
    pageOrder: [...(ep.pageOrder ?? [])],
    activeStoryVersionId: ep.activeStoryVersionId ?? null,
    pages: pages.filter(p => !p.deletedAt).map(p => ({ id: p.id, ...pick(p, PAGE_KEYS) }) as SnapPage),
    panels: panels.filter(p => !p.deletedAt).map(p => ({ id: p.id, ...pick(p, PANEL_KEYS) }) as SnapPanel),
  }
}

/** 되돌리기: 스냅숏의 장·컷은 그대로 다시 쓰고, 지금만 있는 장·컷은 지운다(deletedAt) */
export function restorePlan(snap: SnapshotData, pages: Page[], panels: Panel[]) {
  const keepPages = new Set(snap.pages.map(p => p.id))
  const keepPanels = new Set(snap.panels.map(p => p.id))
  return {
    episode: { title: snap.title, pageOrder: snap.pageOrder, activeStoryVersionId: snap.activeStoryVersionId },
    pages: snap.pages.map(({ id, ...data }) => ({ id, data: pick(data, PAGE_KEYS) })),
    panels: snap.panels.map(({ id, ...data }) => ({ id, data: pick(data, PANEL_KEYS) })),
    removePages: pages.filter(p => !p.deletedAt && !keepPages.has(p.id)).map(p => p.id),
    removePanels: panels.filter(p => !p.deletedAt && !keepPanels.has(p.id)).map(p => p.id),
  }
}

export type ChangeKind = 'scene' | 'dialogues' | 'image' | 'bubbles' | 'other'
export interface SnapshotDiff {
  title: boolean
  pages: [number, number]
  added: number
  removed: number
  changed: { panelId: string, scene: string, kinds: ChangeKind[] }[]
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** a(이전) → b(이후)에서 바뀐 것 */
export function snapshotDiff(a: SnapshotData, b: SnapshotData): SnapshotDiff {
  const before = new Map(a.panels.map(p => [p.id, p]))
  const afterIds = new Set(b.panels.map(p => p.id))
  const changed: SnapshotDiff['changed'] = []
  for (const p of b.panels) {
    const o = before.get(p.id)
    if (!o) continue
    const kinds: ChangeKind[] = []
    if (!same(o.scene, p.scene)) kinds.push('scene')
    if (!same(o.dialogues, p.dialogues)) kinds.push('dialogues')
    if (!same(o.selectedCandidateId, p.selectedCandidateId) || !same(o.crop, p.crop)) kinds.push('image')
    if (!same(o.bubbles, p.bubbles)) kinds.push('bubbles')
    const rest = PANEL_KEYS.filter(k => !['scene', 'dialogues', 'selectedCandidateId', 'crop', 'bubbles', 'staleFrom'].includes(k))
    if (rest.some(k => !same(o[k], p[k]))) kinds.push('other')
    if (kinds.length) changed.push({ panelId: p.id, scene: p.scene || o.scene, kinds })
  }
  return {
    title: a.title !== b.title,
    pages: [a.pageOrder.length, b.pageOrder.length],
    added: b.panels.filter(p => !before.has(p.id)).length,
    removed: a.panels.filter(p => !afterIds.has(p.id)).length,
    changed,
  }
}
