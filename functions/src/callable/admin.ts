import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { adminOverviewInput, logAdminViewInput } from '../../../shared/activity'
import { ERROR_KEYS } from '../../../shared/callables'
import { monthKey } from '../../../shared/usage'
import { authedCallable } from '../lib/callable'

const requireAdmin = (token: Record<string, unknown>) => {
  if (token.admin !== true) throw new HttpsError('permission-denied', ERROR_KEYS.forbidden)
}

/** CMN-51: 워크스페이스 수, 이번 달 AI 비용, 실패율, 모델별 상태 */
export const adminOverview = authedCallable(adminOverviewInput, async ({ token }) => {
  requireAdmin(token)
  const db = getFirestore()
  const month = monthKey()
  const wss = (await db.collection('workspaces').get()).docs
  const usages = await Promise.all(wss.map(w => w.ref.collection('usage').doc(month).get()))
  const rows = wss.map((w, i) => ({ id: w.id, name: (w.get('name') as string) ?? '', ownerId: (w.get('ownerId') as string) ?? '', spentKrw: (usages[i]!.get('spentKrw') as number | undefined) ?? 0, deleteAt: w.get('deleteAt')?.toMillis?.() ?? null }))
    .sort((a, b) => b.spentKrw - a.spentKrw)
  const jobs = (await db.collectionGroup('aiJobs').where('month', '==', month).select('status', 'model').get()).docs
  const byModel: Record<string, { total: number, failed: number }> = {}
  let failed = 0
  for (const j of jobs) {
    const m = (j.get('model') as string) ?? '-'
    const f = j.get('status') === 'failed'
    byModel[m] = { total: (byModel[m]?.total ?? 0) + 1, failed: (byModel[m]?.failed ?? 0) + (f ? 1 : 0) }
    if (f) failed++
  }
  return { month, workspaces: wss.length, spentKrw: rows.reduce((a, r) => a + r.spentKrw, 0), jobs: jobs.length, failed, byModel, rows }
})

/** CMN-54: 운영자가 워크스페이스를 열면 시각·대상·이유를 남긴다. 그 워크스페이스 소유자·관리자도 본다 */
export const logAdminView = authedCallable(logAdminViewInput, async ({ uid, token, data }) => {
  requireAdmin(token)
  const db = getFirestore()
  const ws = db.doc(`workspaces/${data.workspaceId}`)
  if (!(await ws.get()).exists) throw new HttpsError('not-found', ERROR_KEYS.invalidInput)
  await ws.collection('adminViews').add({ by: uid, email: typeof token.email === 'string' ? token.email : null, reason: data.reason, workspaceId: data.workspaceId, at: FieldValue.serverTimestamp() })
  const [episodes, submissions, members] = await Promise.all(['episodes', 'submissions', 'members'].map(c => ws.collection(c).count().get()))
  return { episodes: episodes!.data().count, submissions: submissions!.data().count, members: members!.data().count }
})
