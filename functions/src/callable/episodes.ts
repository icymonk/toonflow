import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { ERROR_KEYS } from '../../../shared/callables'
import { createEpisodeInput, duplicateEpisodeInput, episodeTitle, splitEpisodesInput, trashInput } from '../../../shared/episodes'
import { titleFrom } from '../../../shared/submissions'
import { withDefaults } from '../../../shared/workspace'
import { requireMember } from '../lib/authz'
import { authedCallable } from '../lib/callable'

/** EPI-10·INB-24: 에피소드를 만들고 재료 썰을 "사용됨"으로 연결한다. 바로 입력한 썰은 출처 "내 경험" 제보로 남긴다 */
export const createEpisode = authedCallable(createEpisodeInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'editor')
  const db = getFirestore()
  const ws = db.doc(`workspaces/${data.workspaceId}`)
  const seriesRef = ws.collection('series').doc(data.seriesId)

  return db.runTransaction(async (tx) => {
    const [wsSnap, series, ...subs] = await Promise.all([
      tx.get(ws),
      tx.get(seriesRef),
      ...data.submissionIds.map(id => tx.get(ws.collection('submissions').doc(id))),
    ])
    if (!series.exists || series.get('deletedAt')) throw new HttpsError('not-found', ERROR_KEYS.invalidInput)
    if (subs.some(s => !s.exists || s.get('deletedAt') || !['accepted', 'used'].includes(s.get('status') as string))) {
      throw new HttpsError('failed-precondition', ERROR_KEYS.invalidInput)
    }

    const defaults = withDefaults(wsSnap.get('defaults'))
    const epRef = ws.collection('episodes').doc()
    const now = FieldValue.serverTimestamp()
    const submissionIds = [...data.submissionIds]
    if (data.storyText) {
      const ref = ws.collection('submissions').doc()
      submissionIds.push(ref.id)
      tx.set(ref, {
        title: titleFrom(data.storyTitle ?? '', data.storyText), body: data.storyText, source: 'self', sourceNote: data.storyNote ?? '', tags: [], starred: false, note: '',
        status: 'used', episodeIds: [epRef.id], createdBy: uid, createdAt: now,
      })
    }
    for (const s of subs) tx.update(s.ref, { status: 'used', episodeIds: FieldValue.arrayUnion(epRef.id) })

    const number = ((series.get('episodeCount') as number | undefined) ?? 0) + 1
    tx.set(epRef, {
      seriesId: data.seriesId,
      title: episodeTitle(data.title, number),
      number,
      step: 'story',
      status: 'active',
      archivedAt: null,
      settings: {
        tone: data.tone,
        pageCount: data.pageCount,
        narrator: data.narrator,
        aspect: (series.get('aspect') as string | undefined) ?? defaults.aspect,
        styleId: series.get('styleId') ?? null,
        characterIds: series.get('mainCharacterIds') ?? [],
        extraRequest: '',
      },
      submissionIds,
      activeStoryVersionId: null,
      pageOrder: [],
      staleFrom: null,
      costKrw: 0,
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    tx.update(seriesRef, { episodeCount: number, updatedAt: now })
    return { episodeId: epRef.id }
  })
})

/** STO-16: 지금 화는 1부분만 남기고, 나머지 부분으로 같은 작품에 다음 화들을 만든다. 재료 썰 연결은 그대로 */
export const splitEpisodes = authedCallable(splitEpisodesInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'editor')
  const db = getFirestore()
  const ws = db.doc(`workspaces/${data.workspaceId}`)
  const epRef = ws.collection('episodes').doc(data.episodeId)
  return db.runTransaction(async (tx) => {
    const ep = await tx.get(epRef)
    if (!ep.exists || ep.get('deletedAt')) throw new HttpsError('not-found', ERROR_KEYS.invalidInput)
    const seriesRef = ws.collection('series').doc(ep.get('seriesId') as string)
    const series = await tx.get(seriesRef)
    if (!series.exists || series.get('deletedAt')) throw new HttpsError('not-found', ERROR_KEYS.invalidInput)
    const submissionIds = (ep.get('submissionIds') as string[] | undefined) ?? []
    const subs = await Promise.all(submissionIds.map(id => tx.get(ws.collection('submissions').doc(id))))
    const now = FieldValue.serverTimestamp()
    const total = data.parts.length
    const [first, ...rest] = data.parts
    tx.update(epRef, { materialPart: { index: 1, total, text: first!.text }, ...(first!.title ? { title: first!.title } : {}), episodePlan: null, updatedAt: now })
    const base = (series.get('episodeCount') as number | undefined) ?? 0
    const ids: string[] = []
    rest.forEach((part, i) => {
      const ref = ws.collection('episodes').doc()
      ids.push(ref.id)
      const number = base + i + 1
      tx.set(ref, {
        seriesId: ep.get('seriesId'), title: episodeTitle(part.title, number), number, step: 'story', status: 'active', archivedAt: null,
        settings: { ...(ep.get('settings') as object), extraRequest: '' }, submissionIds, materialPart: { index: i + 2, total, text: part.text },
        activeStoryVersionId: null, pageOrder: [], staleFrom: null, costKrw: 0, createdBy: uid, createdAt: now, updatedAt: now, deletedAt: null,
      })
    })
    for (const s of subs) if (s.exists) tx.update(s.ref, { episodeIds: FieldValue.arrayUnion(...ids) })
    tx.update(seriesRef, { episodeCount: base + rest.length, updatedAt: now })
    return { episodeIds: ids }
  })
})

const STRUCTURE_KEYS = ['pageId', 'characterNames', 'characterIds', 'shot', 'styleId'] as const
const FULL_KEYS = [...STRUCTURE_KEYS, 'scene', 'place', 'mood', 'expression', 'action', 'outfit', 'note', 'dialogues', 'crop', 'bubbles', 'refImage'] as const

/** EPI-14: 같은 작품의 새 회차로 복제. full이면 각색안과 고른 그림 후보도 복사한다 (이미지 파일은 같은 파일을 가리킴) */
export const duplicateEpisode = authedCallable(duplicateEpisodeInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'editor')
  const db = getFirestore()
  const ws = db.doc(`workspaces/${data.workspaceId}`)
  const src = ws.collection('episodes').doc(data.episodeId)
  const ep = await src.get()
  if (!ep.exists || ep.get('deletedAt')) throw new HttpsError('not-found', ERROR_KEYS.invalidInput)
  const full = data.mode === 'full'
  const [pages, panels, versions] = await Promise.all([
    src.collection('pages').where('deletedAt', '==', null).get(),
    src.collection('panels').where('deletedAt', '==', null).get(),
    full ? src.collection('storyVersions').get() : Promise.resolve(null),
  ])
  if (pages.size + panels.size * 2 + (versions?.size ?? 0) > 450) throw new HttpsError('failed-precondition', ERROR_KEYS.invalidInput)

  const seriesRef = ws.collection('series').doc(ep.get('seriesId') as string)
  const dst = ws.collection('episodes').doc()
  const now = FieldValue.serverTimestamp()
  const pageId = new Map(pages.docs.map(p => [p.id, dst.collection('pages').doc().id]))
  const panelId = new Map(panels.docs.map(p => [p.id, dst.collection('panels').doc().id]))
  const versionId = new Map((versions?.docs ?? []).map(v => [v.id, dst.collection('storyVersions').doc().id]))
  const selected = full
    ? await Promise.all(panels.docs.map(p => (p.get('selectedCandidateId') ? p.ref.collection('candidates').doc(p.get('selectedCandidateId') as string).get() : null)))
    : []

  return db.runTransaction(async (tx) => {
    const series = await tx.get(seriesRef)
    if (!series.exists || series.get('deletedAt')) throw new HttpsError('not-found', ERROR_KEYS.invalidInput)
    const number = ((series.get('episodeCount') as number | undefined) ?? 0) + 1
    const activeV = ep.get('activeStoryVersionId') as string | null
    tx.set(dst, {
      seriesId: ep.get('seriesId'),
      title: `${String(ep.get('title') ?? '')} (복제)`.slice(0, 80),
      number,
      step: full ? ep.get('step') : (pages.size ? 'storyboard' : 'story'),
      status: 'active',
      archivedAt: null,
      settings: ep.get('settings') ?? {},
      submissionIds: ep.get('submissionIds') ?? [],
      activeStoryVersionId: full && activeV ? versionId.get(activeV) ?? null : null,
      pageOrder: ((ep.get('pageOrder') as string[] | undefined) ?? []).map(id => pageId.get(id)).filter(Boolean),
      staleFrom: null,
      costKrw: 0,
      duplicatedFrom: src.id,
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    for (const p of pages.docs) {
      tx.set(dst.collection('pages').doc(pageId.get(p.id)!), {
        layout: p.get('layout'),
        ...(p.get('title') ? { title: p.get('title') } : {}),
        panelIds: ((p.get('panelIds') as string[] | undefined) ?? []).map(id => panelId.get(id)).filter(Boolean),
        deletedAt: null,
        updatedAt: now,
      })
    }
    panels.docs.forEach((p, i) => {
      const out: Record<string, unknown> = { scene: '', place: '', mood: '', expression: '', action: '', outfit: '', note: '', dialogues: [], characterNames: [], characterIds: [], shot: '' }
      for (const k of full ? FULL_KEYS : STRUCTURE_KEYS) if (p.get(k) !== undefined) out[k] = p.get(k)
      out.pageId = pageId.get(p.get('pageId') as string) ?? ''
      const ref = dst.collection('panels').doc(panelId.get(p.id)!)
      const cand = selected[i]
      out.selectedCandidateId = cand?.exists ? cand.id : null
      if (cand?.exists) tx.set(ref.collection('candidates').doc(cand.id), { ...cand.data(), source: 'import', episodeId: dst.id, panelId: ref.id, createdAt: now })
      tx.set(ref, { ...out, staleFrom: null, deletedAt: null, updatedAt: now })
    })
    for (const v of versions?.docs ?? []) tx.set(dst.collection('storyVersions').doc(versionId.get(v.id)!), v.data())
    tx.update(seriesRef, { episodeCount: number, updatedAt: now })
    return { episodeId: dst.id }
  })
})

/** CMN-30·EPI-16: 휴지통으로. 작품은 살아 있는 에피소드가 없을 때만 */
export const deleteToTrash = authedCallable(trashInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'editor')
  const db = getFirestore()
  const ws = db.doc(`workspaces/${data.workspaceId}`)
  const ref = ws.collection(data.kind === 'episode' ? 'episodes' : 'series').doc(data.id)
  await db.runTransaction(async (tx) => {
    const [snap, live] = await Promise.all([
      tx.get(ref),
      data.kind === 'series' ? tx.get(ws.collection('episodes').where('seriesId', '==', data.id).where('deletedAt', '==', null).limit(1)) : null,
    ])
    if (!snap.exists || snap.get('deletedAt')) throw new HttpsError('not-found', ERROR_KEYS.invalidInput)
    if (live && !live.empty) throw new HttpsError('failed-precondition', ERROR_KEYS.seriesNotEmpty)
    tx.update(ref, { deletedAt: FieldValue.serverTimestamp(), deletedBy: uid })
  })
  return { ok: true as const }
})
