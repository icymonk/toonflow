import type { Series } from '#shared/episodes'
import type { Episode, Step } from '#shared/episodes'
import type { JobStatus, JobType, StartAiJobInput } from '#shared/jobs'
import type { Page, PageLayout, Panel } from '#shared/studio'
import type { Snapshot } from '#shared/snapshot'
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { restorePlan, SNAPSHOT_MAX_PANELS, SNAPSHOT_NAME_MAX, takeSnapshot } from '#shared/snapshot'
import { ACTIVE_STATUSES } from '#shared/jobs'
import { createHistory, emptyPanel, LAYOUT_BY_COUNT, movedPanelIds, movePage, movePanelTo, orderCuts } from '#shared/studio'

interface ActiveJob { id: string, type: JobType, status: JobStatus, target: StartAiJobInput['target'] }

/** 제작실 (STU-01~04·20~22·25): 에피소드·장·컷 실시간 구독, 자동 저장 상태, 실행 취소 */
export function useStudio(episodeId: Ref<string>) {
  const { $firestore } = useNuxtApp()
  const auth = useAuthStore()
  const episode = ref<Episode | null>(null)
  const missing = ref(false)
  const seriesName = ref('')
  const seriesReviewItems = ref<string[]>([])
  const series = ref<Series | null>(null)
  const pages = ref<Page[]>([])
  const panels = ref<Panel[]>([])
  const jobs = ref<ActiveJob[]>([])
  const snapshots = ref<Snapshot[]>([])
  const wsPath = () => ['workspaces', auth.workspace!.id] as const
  const epRef = () => doc($firestore, ...wsPath(), 'episodes', episodeId.value)
  const sub = (name: 'pages' | 'panels' | 'snapshots') => collection(epRef(), name)

  const stops: (() => void)[] = []
  watch(() => [auth.workspace?.id, episodeId.value] as const, ([ws, id]) => {
    stops.splice(0).forEach(s => s())
    episode.value = null
    missing.value = false
    if (!ws || !id) return
    stops.push(
      onSnapshot(epRef(), (snap) => {
        const data = snap.data()
        if (!snap.exists() || data?.deletedAt) {
          missing.value = true
          return
        }
        const ep = { id: snap.id, ...data } as Episode
        if (ep.seriesId !== episode.value?.seriesId) {
          getDoc(doc($firestore, ...wsPath(), 'series', ep.seriesId)).then((s) => {
            seriesName.value = (s.get('name') as string) ?? ''
            seriesReviewItems.value = (s.get('reviewItems') as string[] | undefined) ?? []
            series.value = s.exists() ? ({ id: s.id, ...s.data() } as Series) : null
          })
        }
        episode.value = ep
      }, () => (missing.value = true)),
      onSnapshot(sub('pages'), s => (pages.value = s.docs.map(d => ({ id: d.id, ...d.data() }) as Page))),
      onSnapshot(sub('panels'), s => (panels.value = s.docs.map(d => ({ id: d.id, ...d.data() }) as Panel))),
      onSnapshot(query(sub('snapshots'), orderBy('createdAt', 'desc')), s => (snapshots.value = s.docs.map(d => ({ id: d.id, ...d.data() }) as Snapshot)), () => {}),
      onSnapshot(
        query(collection($firestore, ...wsPath(), 'aiJobs'), where('target.episodeId', '==', id), where('status', 'in', [...ACTIVE_STATUSES])),
        s => (jobs.value = s.docs.map(d => ({ id: d.id, ...d.data() }) as ActiveJob)),
        () => {},
      ),
    )
  }, { immediate: true })
  onScopeDispose(() => stops.forEach(s => s()))

  const cuts = computed(() => orderCuts(episode.value?.pageOrder ?? [], pages.value, panels.value))
  const busyPanels = computed(() => new Set(jobs.value.map(j => j.target.panelId).filter(Boolean)))

  // STU-20 저장 상태
  const pending = ref(0)
  const savedAt = ref<number | null>(null)
  const failed = ref<(() => Promise<unknown>) | null>(null)
  async function track<T>(fn: () => Promise<T>): Promise<T> {
    pending.value++
    try {
      const out = await fn()
      savedAt.value = Date.now()
      failed.value = null
      return out
    }
    catch (error) {
      failed.value = fn
      throw error
    }
    finally {
      pending.value--
    }
  }
  const retry = () => (failed.value ? track(failed.value) : Promise.resolve())

  // STU-21 실행 취소
  const history = createHistory()
  const canUndo = ref(false)
  const canRedo = ref(false)
  const sync = () => {
    canUndo.value = history.canUndo
    canRedo.value = history.canRedo
  }
  const record = (label: string, undo: () => Promise<unknown>, redo: () => Promise<unknown>) => {
    history.push({ label, undo: () => track(undo), redo: () => track(redo) })
    sync()
  }
  const undo = async () => {
    const c = await history.undo()
    sync()
    return c
  }
  const redo = async () => {
    const c = await history.redo()
    sync()
    return c
  }

  const touch = () => ({ updatedAt: serverTimestamp() })
  const updateEpisode = (patch: Record<string, unknown>) => track(() => updateDoc(epRef(), { ...patch, ...touch() }))
  /** PUB-06·10: 작품 워터마크·고정 인사말·해시태그 */
  async function updateSeries(patch: Partial<Pick<Series, 'hashtags' | 'greeting' | 'watermark' | 'memo' | 'coverText' | 'outroText'>>) {
    const id = episode.value?.seriesId
    if (!id) return
    if (series.value) series.value = { ...series.value, ...patch }
    await track(() => updateDoc(doc($firestore, ...wsPath(), 'series', id), { ...patch, updatedAt: serverTimestamp() }))
  }
  /** REV-14: 작품마다 검수 항목 추가 */
  async function setSeriesReviewItems(items: string[]) {
    const id = episode.value?.seriesId
    if (!id) return
    seriesReviewItems.value = items
    await track(() => updateDoc(doc($firestore, ...wsPath(), 'series', id), { reviewItems: items, updatedAt: serverTimestamp() }))
  }
  const rename = (title: string) => updateEpisode({ title })
  const setStep = (step: Step) => (episode.value?.status === 'active' ? updateEpisode({ step }) : Promise.resolve())
  const updatePanel = (id: string, patch: Partial<Omit<Panel, 'id'>>) => track(() => updateDoc(doc(sub('panels'), id), { ...patch, ...touch() }))

  /** 장 하나(컷 1개)를 afterPageId 뒤에 추가. 새 컷 id를 돌려준다 */
  async function addPage(afterPageId?: string, first = false) {
    const before = [...(episode.value?.pageOrder ?? [])]
    const pageRef = doc(sub('pages'))
    const panelRef = doc(sub('panels'))
    const at = first ? 0 : afterPageId ? before.indexOf(afterPageId) + 1 : before.length
    const after = [...before.slice(0, at), pageRef.id, ...before.slice(at)]
    const apply = (order: string[], deleted: boolean) => {
      const b = writeBatch($firestore)
      b.set(pageRef, { layout: '1', panelIds: [panelRef.id], deletedAt: deleted ? serverTimestamp() : null, ...touch() })
      b.set(panelRef, { ...emptyPanel(pageRef.id), deletedAt: deleted ? serverTimestamp() : null, ...touch() })
      b.update(epRef(), { pageOrder: order, ...touch() })
      return b.commit()
    }
    await track(() => apply(after, false))
    record('addPage', () => apply(before, true), () => apply(after, false))
    return panelRef.id
  }

  async function addPanel(pageId: string) {
    const page = pages.value.find(p => p.id === pageId)
    if (!page || page.panelIds.length >= 4) return null
    const before = [...page.panelIds]
    const panelRef = doc(sub('panels'))
    const apply = (ids: string[], deleted: boolean) => {
      const b = writeBatch($firestore)
      b.set(panelRef, { ...emptyPanel(pageId), deletedAt: deleted ? serverTimestamp() : null, ...touch() })
      b.update(doc(sub('pages'), pageId), { panelIds: ids, layout: LAYOUT_BY_COUNT[ids.length], ...touch() })
      return b.commit()
    }
    await track(() => apply([...before, panelRef.id], false))
    record('addPanel', () => apply(before, true), () => apply([...before, panelRef.id], false))
    return panelRef.id
  }

  /** STU-22: 컷 삭제. 장이 비면 장도 지운다. 되돌릴 함수는 실행 취소 스택에도 들어간다 */
  async function deletePanel(panelId: string) {
    const cut = cuts.value.find(c => c.panel.id === panelId)
    if (!cut) return
    const pageId = cut.page.id
    const ids = [...cut.page.panelIds]
    const order = [...(episode.value?.pageOrder ?? [])]
    const left = ids.filter(id => id !== panelId)
    const apply = (removed: boolean) => {
      const b = writeBatch($firestore)
      b.update(doc(sub('panels'), panelId), { deletedAt: removed ? serverTimestamp() : null, ...touch() })
      const pIds = removed ? left : ids
      b.update(doc(sub('pages'), pageId), { panelIds: pIds, layout: LAYOUT_BY_COUNT[pIds.length], deletedAt: removed && left.length === 0 ? serverTimestamp() : null, ...touch() })
      if (left.length === 0) b.update(epRef(), { pageOrder: removed ? order.filter(id => id !== pageId) : order, ...touch() })
      return b.commit()
    }
    await track(() => apply(true))
    record('deletePanel', () => apply(false), () => apply(true))
  }

  async function movePanel(panelId: string, dir: -1 | 1) {
    const next = movedPanelIds(cuts.value, panelId, dir)
    if (!next) return
    const prev = Object.fromEntries(Object.keys(next).map(id => [id, [...pages.value.find(p => p.id === id)!.panelIds]]))
    const apply = (map: Record<string, string[]>) => {
      const b = writeBatch($firestore)
      for (const [pageId, ids] of Object.entries(map)) {
        b.update(doc(sub('pages'), pageId), { panelIds: ids, layout: LAYOUT_BY_COUNT[ids.length], deletedAt: null, ...touch() })
      }
      b.update(doc(sub('panels'), panelId), { pageId: Object.keys(map).find(id => map[id]!.includes(panelId)), ...touch() })
      return b.commit()
    }
    await track(() => apply(next))
    record('movePanel', () => apply(prev), () => apply(next))
  }

  /** SBD-21: 끌어서 놓은 자리로 */
  async function dropPanel(panelId: string, toPageId: string, toIndex: number) {
    const live = pages.value.filter(p => !p.deletedAt)
    const next = movePanelTo(live, panelId, toPageId, toIndex)
    if (!next) return false
    const prev = Object.fromEntries(Object.keys(next).map(id => [id, [...live.find(p => p.id === id)!.panelIds]]))
    const order = [...(episode.value?.pageOrder ?? [])]
    const emptied = Object.keys(next).filter(id => next[id]!.length === 0)
    const apply = (map: Record<string, string[]>, removeEmpty: boolean) => {
      const b = writeBatch($firestore)
      for (const [pageId, ids] of Object.entries(map)) {
        b.update(doc(sub('pages'), pageId), { panelIds: ids, layout: LAYOUT_BY_COUNT[ids.length], deletedAt: removeEmpty && ids.length === 0 ? serverTimestamp() : null, ...touch() })
      }
      if (emptied.length) b.update(epRef(), { pageOrder: removeEmpty ? order.filter(id => !emptied.includes(id)) : order, ...touch() })
      b.update(doc(sub('panels'), panelId), { pageId: Object.keys(map).find(id => map[id]!.includes(panelId)), ...touch() })
      return b.commit()
    }
    await track(() => apply(next, true))
    record('dropPanel', () => apply(prev, false), () => apply(next, true))
    return true
  }

  async function shiftPage(pageId: string, dir: -1 | 1) {
    const before = [...(episode.value?.pageOrder ?? [])]
    const after = movePage(before, pageId, dir)
    if (!after) return
    await updateEpisode({ pageOrder: after })
    record('movePage', () => updateEpisode({ pageOrder: before }), () => updateEpisode({ pageOrder: after }))
  }

  /** SBD-20: 컷 복제 (같은 장, 바로 뒤). 장이 가득이면 새 장으로 */
  async function duplicatePanel(panelId: string) {
    const cut = cuts.value.find(c => c.panel.id === panelId)
    if (!cut) return null
    const { id: _id, pageId: _page, ...data } = cut.panel
    const id = cut.page.panelIds.length < 4 ? await addPanel(cut.page.id) : await addPage(cut.page.id)
    if (id) await updatePanel(id, { ...data, selectedCandidateId: null, staleFrom: null })
    return id
  }

  /** SBD-22 쪼개기: 대사 뒤쪽 절반을 바로 뒤 새 컷으로 */
  async function splitPanel(panelId: string) {
    const cut = cuts.value.find(c => c.panel.id === panelId)
    if (!cut || cut.panel.dialogues.length < 2) return null
    const half = Math.ceil(cut.panel.dialogues.length / 2)
    const { id: _id, pageId: _page, ...data } = cut.panel
    const id = cut.page.panelIds.length < 4 ? await addPanel(cut.page.id) : await addPage(cut.page.id)
    if (!id) return null
    await updatePanel(id, { ...data, dialogues: data.dialogues.slice(half), bubbles: null, selectedCandidateId: null, staleFrom: null })
    await updatePanel(panelId, { dialogues: cut.panel.dialogues.slice(0, half), bubbles: null })
    return id
  }
  /** SBD-22 합치기: 같은 장의 다음 컷을 이 컷에 */
  async function mergeNext(panelId: string) {
    const cut = cuts.value.find(c => c.panel.id === panelId)
    const nextId = cut?.page.panelIds[cut.page.panelIds.indexOf(panelId) + 1]
    const next = cuts.value.find(c => c.panel.id === nextId)
    if (!cut || !next) return false
    await updatePanel(panelId, { scene: [cut.panel.scene, next.panel.scene].filter(Boolean).join(' / ').slice(0, 2000), dialogues: [...cut.panel.dialogues, ...next.panel.dialogues], bubbles: null })
    await deletePanel(next.panel.id)
    return true
  }
  /** SBD-24 작품 고정 장: 표지는 맨 앞, 마지막 인사는 맨 뒤 */
  async function addFixedPages(cover?: string, outro?: string) {
    const line = (text: string) => [{ id: crypto.randomUUID(), type: 'narration' as const, speaker: '', speakerId: null, text: text.trim().slice(0, 200) }]
    if (cover?.trim()) await updatePanel(await addPage(undefined, true), { scene: '표지', dialogues: line(cover) })
    if (outro?.trim()) await updatePanel(await addPage(), { scene: '마지막 인사', dialogues: line(outro) })
  }

  /** SBD-23 장 배치 */
  // STU-23 스냅숏
  const currentSnapshot = () => takeSnapshot(episode.value!, pages.value, panels.value)
  function saveSnapshot(name: string) {
    const data = currentSnapshot()
    if (data.panels.length > SNAPSHOT_MAX_PANELS || data.pages.length > SNAPSHOT_MAX_PANELS) return Promise.reject(new Error('snapshot-too-large'))
    return track(() => addDoc(sub('snapshots'), { ...data, name: name.trim().slice(0, SNAPSHOT_NAME_MAX), createdBy: auth.user!.uid, createdAt: serverTimestamp() }))
  }
  const removeSnapshot = (id: string) => track(() => deleteDoc(doc(sub('snapshots'), id)))
  /** 지금 상태를 backupName으로 먼저 남기고 되돌린다. 실행 취소 기록은 비운다 */
  async function restoreSnapshot(snap: Snapshot, backupName: string) {
    await saveSnapshot(backupName)
    const plan = restorePlan(snap, pages.value, panels.value)
    const b = writeBatch($firestore)
    b.update(epRef(), { ...plan.episode, ...touch() })
    for (const p of plan.pages) b.set(doc(sub('pages'), p.id), { ...p.data, deletedAt: null, ...touch() })
    for (const p of plan.panels) b.set(doc(sub('panels'), p.id), { ...p.data, deletedAt: null, ...touch() })
    for (const id of plan.removePages) b.update(doc(sub('pages'), id), { deletedAt: serverTimestamp(), ...touch() })
    for (const id of plan.removePanels) b.update(doc(sub('panels'), id), { deletedAt: serverTimestamp(), ...touch() })
    await track(() => b.commit())
    history.clear()
    sync()
  }

  const setLayout = (pageId: string, layout: PageLayout) => track(() => updateDoc(doc(sub('pages'), pageId), { layout, ...touch() }))

  return {
    episode, missing, seriesName, seriesReviewItems, setSeriesReviewItems, series, updateSeries, splitPanel, mergeNext, addFixedPages, cuts, busyPanels, jobs, dropPanel, shiftPage, duplicatePanel, setLayout,
    pending, savedAt, failed, retry, canUndo, canRedo, undo, redo,
    rename, setStep, updatePanel, updateEpisode, addPage, addPanel, deletePanel, movePanel,
    snapshots, currentSnapshot, saveSnapshot, removeSnapshot, restoreSnapshot,
  }
}
