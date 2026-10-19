import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { cleanupInput, usageInput } from '../../../shared/assets'
import { requireMember } from '../lib/authz'
import { authedCallable } from '../lib/callable'

/** AST-07 · ILL-15: 기간이 지난, 선택·즐겨찾기 안 된 후보와 그 파일을 지운다 */
export const cleanupCandidates = authedCallable(cleanupInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'editor')
  const before = new Date(Date.now() - data.olderThanDays * 86_400_000)
  const snap = await getFirestore().collectionGroup('candidates').where('workspaceId', '==', data.workspaceId).where('createdAt', '<', before).get()
  const bucket = getStorage().bucket()
  let deleted = 0
  for (const d of snap.docs) {
    if (d.get('favorite')) continue
    const panel = await d.ref.parent.parent!.get()
    if (panel.get('selectedCandidateId') === d.id) continue
    await d.ref.delete()
    const path = d.get('imagePath') as string | undefined
    if (path?.startsWith(`workspaces/${data.workspaceId}/aiJobs/`)) {
      // 복제·가져오기로 같은 파일을 가리키는 후보가 남아 있으면 파일은 두기
      const others = await getFirestore().collectionGroup('candidates').where('workspaceId', '==', data.workspaceId).where('imagePath', '==', path).limit(1).get()
      if (others.empty) await bucket.file(path).delete().catch(() => {})
    }
    deleted++
  }
  return { deleted }
})

/** AST-06 · AIU-23: 워크스페이스 Storage 사용량 */
export const storageUsage = authedCallable(usageInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'viewer')
  const [files] = await getStorage().bucket().getFiles({ prefix: `workspaces/${data.workspaceId}/` })
  let ai = 0
  let refs = 0
  for (const f of files) {
    const n = Number(f.metadata.size ?? 0)
    if (f.name.includes('/aiJobs/')) ai += n
    else refs += n
  }
  return { ai, refs, total: ai + refs }
})
