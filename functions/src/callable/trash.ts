import type { TrashKind } from '../../../shared/trash'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { ERROR_KEYS } from '../../../shared/callables'
import { TRASH_COLLECTION, trashItemInput } from '../../../shared/trash'
import { requireMember } from '../lib/authz'
import { authedCallable } from '../lib/callable'

const refOf = (ws: string, kind: TrashKind, id: string) => getFirestore().doc(`workspaces/${ws}/${TRASH_COLLECTION[kind]}/${id}`)
async function trashed(ws: string, kind: TrashKind, id: string) {
  const ref = refOf(ws, kind, id)
  const snap = await ref.get()
  if (!snap.exists || !snap.get('deletedAt')) throw new HttpsError('not-found', ERROR_KEYS.invalidInput)
  return ref
}

/** CMN-30: 되살리기 */
export const restoreFromTrash = authedCallable(trashItemInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'editor')
  const ref = await trashed(data.workspaceId, data.kind, data.id)
  await ref.update({ deletedAt: null, deletedBy: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() })
  return { ok: true as const }
})

/** CMN-30: 바로 삭제 (하위 문서까지) */
export const purgeFromTrash = authedCallable(trashItemInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'editor')
  const ref = await trashed(data.workspaceId, data.kind, data.id)
  await getFirestore().recursiveDelete(ref)
  return { ok: true as const }
})
