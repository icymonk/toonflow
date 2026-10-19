import { createHash } from 'node:crypto'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { ERROR_KEYS } from '../../../shared/callables'
import { rateCheck } from '../../../shared/intake'
import { reportPageInput, reportSubmissionInput, resolveReportInput } from '../../../shared/reports'
import { requireMember } from '../lib/authz'
import { authedCallable, publicCallable } from '../lib/callable'

/** CMN-40: 공개 제보 페이지 신고 (로그인 없이). 제출과 같은 10분 3회 제한 */
export const reportPage = publicCallable(reportPageInput, async ({ data, ip }) => {
  const db = getFirestore()
  const page = await db.doc(`intake/${data.slug}`).get()
  if (!page.exists) throw new HttpsError('not-found', ERROR_KEYS.intakeClosed)
  const key = createHash('sha256').update(`report:${data.slug}:${ip ?? 'unknown'}`).digest('hex').slice(0, 32)
  const rateRef = db.doc(`intake/${data.slug}/rate/r_${key}`)
  await db.runTransaction(async (tx) => {
    const r = rateCheck((await tx.get(rateRef)).get('times') ?? [], Date.now())
    if (!r.ok) throw new HttpsError('resource-exhausted', ERROR_KEYS.tooMany)
    tx.set(rateRef, { times: r.times })
  })
  await db.collection('reports').add({
    kind: 'page', slug: data.slug, workspaceId: page.get('workspaceId'), reason: data.reason, detail: data.detail,
    status: 'open', by: null, createdAt: FieldValue.serverTimestamp(),
  })
  return { ok: true as const }
})

/** CMN-40: 작가가 부적절한 제보를 운영자에게 신고 */
export const reportSubmission = authedCallable(reportSubmissionInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'editor')
  const db = getFirestore()
  const sub = await db.doc(`workspaces/${data.workspaceId}/submissions/${data.submissionId}`).get()
  if (!sub.exists) throw new HttpsError('not-found', ERROR_KEYS.invalidInput)
  const slug = sub.get('source') === 'link' ? ((await db.doc(`workspaces/${data.workspaceId}/config/intake`).get()).get('slug') as string | undefined) ?? '' : ''
  await db.collection('reports').add({
    kind: 'submission', slug, workspaceId: data.workspaceId, submissionId: data.submissionId, reason: data.reason, detail: data.detail,
    status: 'open', by: uid, createdAt: FieldValue.serverTimestamp(),
  })
  return { ok: true as const }
})

/** CMN-53: 운영자 신고 처리. 막기는 `intakeBlocks/{slug}`, 처리 내용은 신고 문서 `log`에 쌓인다 */
export const resolveReport = authedCallable(resolveReportInput, async ({ uid, token, data }) => {
  if (token.admin !== true) throw new HttpsError('permission-denied', ERROR_KEYS.forbidden)
  const db = getFirestore()
  const ref = db.doc(`reports/${data.reportId}`)
  const r = await ref.get()
  if (!r.exists) throw new HttpsError('not-found', ERROR_KEYS.invalidInput)
  const slug = r.get('slug') as string
  if (data.action !== 'dismiss' && !slug) throw new HttpsError('failed-precondition', ERROR_KEYS.invalidInput)
  const now = FieldValue.serverTimestamp()
  const batch = db.batch()
  if (data.action === 'block') batch.set(db.doc(`intakeBlocks/${slug}`), { workspaceId: r.get('workspaceId'), reportId: ref.id, by: uid, at: now })
  if (data.action === 'unblock') batch.delete(db.doc(`intakeBlocks/${slug}`))
  batch.update(ref, {
    status: 'resolved', action: data.action, note: data.note, resolvedBy: uid, resolvedAt: now,
    log: FieldValue.arrayUnion({ action: data.action, note: data.note, by: uid, at: Date.now() }),
  })
  await batch.commit()
  return { ok: true as const }
})
