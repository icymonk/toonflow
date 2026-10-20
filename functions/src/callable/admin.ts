import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { adminOverviewInput, logAdminViewInput } from '../../../shared/activity'
import { ERROR_KEYS } from '../../../shared/callables'
import { asPlan, effectiveLimitKrw, grantPlanInput, monthKey } from '../../../shared/usage'
import { logActivity } from '../lib/activity'
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
  const [usages, limits] = await Promise.all([Promise.all(wss.map(w => w.ref.collection('usage').doc(month).get())), db.doc('config/limits').get()])
  const rows = wss.map((w, i) => {
    const plan = asPlan(w.get('plan'))
    const creditKrw = (usages[i]!.get('creditKrw') as number | undefined) ?? 0
    return {
      id: w.id,
      name: (w.get('name') as string) ?? '',
      ownerId: (w.get('ownerId') as string) ?? '',
      spentKrw: (usages[i]!.get('spentKrw') as number | undefined) ?? 0,
      deleteAt: w.get('deleteAt')?.toMillis?.() ?? null,
      plan,
      creditKrw,
      limitKrw: effectiveLimitKrw({ plan, wsLimitKrw: w.get('monthlyLimitKrw') as number | undefined, limits: limits.data(), creditKrw }),
    }
  })
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

/** AIU-24: 결제 전에는 운영자가 요금제를 정하고 이번 달 추가 크레딧을 준다. 워크스페이스 활동 기록에 남는다 */
export const grantPlan = authedCallable(grantPlanInput, async ({ uid, token, data }) => {
  requireAdmin(token)
  const db = getFirestore()
  const ws = db.doc(`workspaces/${data.workspaceId}`)
  if (!(await ws.get()).exists) throw new HttpsError('not-found', ERROR_KEYS.invalidInput)
  await ws.update({ plan: data.plan })
  if (data.creditKrw > 0) await ws.collection('usage').doc(monthKey()).set({ creditKrw: FieldValue.increment(data.creditKrw) }, { merge: true })
  await logActivity(data.workspaceId, uid, 'plan.grant', { plan: data.plan, creditKrw: data.creditKrw })
  return { ok: true as const }
})
