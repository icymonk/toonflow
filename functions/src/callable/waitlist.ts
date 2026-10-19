import { createHash } from 'node:crypto'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { ERROR_KEYS } from '../../../shared/callables'
import { rateCheck } from '../../../shared/intake'
import { decideWaitlistInput, joinWaitlistInput } from '../../../shared/waitlist'
import { authedCallable, publicCallable } from '../lib/callable'

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32)

/** CMN-41: 랜딩 대기 명단 신청 (로그인 없이). 같은 곳에서 10분 3회. 같은 이메일은 한 건 */
export const joinWaitlist = publicCallable(joinWaitlistInput, async ({ data, ip }) => {
  if (data.website) return { ok: true as const }
  const db = getFirestore()
  const rateRef = db.doc(`waitlistRate/r_${sha(`waitlist:${ip ?? 'unknown'}`)}`)
  await db.runTransaction(async (tx) => {
    const r = rateCheck((await tx.get(rateRef)).get('times') ?? [], Date.now())
    if (!r.ok) throw new HttpsError('resource-exhausted', ERROR_KEYS.tooMany)
    tx.set(rateRef, { times: r.times })
  })
  const ref = db.doc(`waitlist/${sha(data.email)}`)
  await db.runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists) return
    tx.set(ref, { email: data.email, name: data.name, handle: data.handle, note: data.note, status: 'pending', createdAt: FieldValue.serverTimestamp() })
  })
  return { ok: true as const }
})

/** CMN-52: 운영자 승인 → config/access 허용 목록에 이메일 추가. 거절은 상태만 */
export const decideWaitlist = authedCallable(decideWaitlistInput, async ({ uid, token, data }) => {
  if (token.admin !== true) throw new HttpsError('permission-denied', ERROR_KEYS.forbidden)
  const db = getFirestore()
  const ref = db.doc(`waitlist/${data.id}`)
  await db.runTransaction(async (tx) => {
    const w = await tx.get(ref)
    if (!w.exists) throw new HttpsError('not-found', ERROR_KEYS.invalidInput)
    if (data.action === 'approve') tx.set(db.doc('config/access'), { allowedEmails: FieldValue.arrayUnion(w.get('email')) }, { merge: true })
    tx.update(ref, { status: data.action === 'approve' ? 'approved' : 'rejected', decidedAt: FieldValue.serverTimestamp(), decidedBy: uid })
  })
  return { ok: true as const }
})
