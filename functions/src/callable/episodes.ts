import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { ERROR_KEYS } from '../../../shared/callables'
import { createEpisodeInput, episodeTitle, trashInput } from '../../../shared/episodes'
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
        title: titleFrom('', data.storyText), body: data.storyText, source: 'self', sourceNote: '', tags: [], starred: false, note: '',
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
