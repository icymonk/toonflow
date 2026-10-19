import { createHash } from 'node:crypto'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { HttpsError } from 'firebase-functions/v2/https'
import { ERROR_KEYS } from '../../../shared/callables'
import { composeBody, CONSENT_TEXT, findBanned, imageType, INTAKE_LIMITS, intakeSubmitInput, rateCheck } from '../../../shared/intake'
import { titleFrom } from '../../../shared/submissions'
import { publicCallable } from '../lib/callable'

/**
 * INB-02~06: 로그인 없는 제보 링크 제출. 받기 꺼짐·짧은 글·금칙어·반복 제출을 거르고
 * 제보함에 `source: 'link'`로 넣는다. 연락처는 `private/contact`에 따로 둔다 (INB-15)
 */
export const submitIntake = publicCallable(intakeSubmitInput, async ({ data, ip }) => {
  if (data.website) return { ok: true as const }
  const db = getFirestore()
  const page = await db.doc(`intake/${data.slug}`).get()
  if (!page.exists || page.get('enabled') !== true) throw new HttpsError('failed-precondition', ERROR_KEYS.intakeClosed)
  if (data.body.length < INTAKE_LIMITS.minBody) throw new HttpsError('invalid-argument', ERROR_KEYS.tooShort)

  const ws = page.get('workspaceId') as string
  const questions = (page.get('questions') as string[] | undefined) ?? []
  const body = composeBody(data.body, questions, data.answers)
  const banned = ((await db.doc(`workspaces/${ws}/config/intake`).get()).get('bannedWords') as string[] | undefined) ?? []
  if (findBanned(`${body}\n${data.nickname}`, banned)) throw new HttpsError('invalid-argument', ERROR_KEYS.bannedWord)

  const images = page.get('images') === true ? data.images : []
  const files = images.map((b64) => {
    const buf = Buffer.from(b64, 'base64')
    const kind = imageType(buf)
    if (!kind || buf.length > INTAKE_LIMITS.imageBytes) throw new HttpsError('invalid-argument', ERROR_KEYS.invalidInput)
    return { buf, ...kind }
  })

  const key = createHash('sha256').update(`${data.slug}:${ip ?? 'unknown'}`).digest('hex').slice(0, 32)
  const rateRef = db.doc(`intake/${data.slug}/rate/${key}`)
  await db.runTransaction(async (tx) => {
    const r = rateCheck((await tx.get(rateRef)).get('times') ?? [], Date.now())
    if (!r.ok) throw new HttpsError('resource-exhausted', ERROR_KEYS.tooMany)
    tx.set(rateRef, { times: r.times })
  })

  const subRef = db.collection(`workspaces/${ws}/submissions`).doc()
  const bucket = getStorage().bucket()
  const attachments = await Promise.all(files.map(async (f, i) => {
    const path = `workspaces/${ws}/intake/${subRef.id}/${i}.${f.ext}`
    await bucket.file(path).save(f.buf, { contentType: f.type, resumable: false })
    return path
  }))

  const now = FieldValue.serverTimestamp()
  const batch = db.batch()
  batch.set(subRef, {
    title: titleFrom('', data.body),
    body,
    source: 'link',
    sourceNote: '',
    tags: [],
    starred: false,
    note: '',
    status: 'new',
    episodeIds: [],
    attachments,
    notify: !!data.email,
    consent: { text: CONSENT_TEXT, at: now },
    createdBy: 'intake',
    createdAt: now,
  })
  batch.set(subRef.collection('private').doc('contact'), { nickname: data.nickname, email: data.email, createdAt: now })
  await batch.commit()
  return { ok: true as const }
})
