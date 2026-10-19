import { createHash, randomBytes } from 'node:crypto'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { HttpsError } from 'firebase-functions/v2/https'
import { ERROR_KEYS } from '../../../shared/callables'
import { composeBody, CONSENT_TEXT, findBanned, imageType, INTAKE_LIMITS, intakeSubmitInput, intakeTokenInput, rateCheck, submitterState } from '../../../shared/intake'
import { titleFrom } from '../../../shared/submissions'
import { publicCallable } from '../lib/callable'

/**
 * INB-02~06: 로그인 없는 제보 링크 제출. 받기 꺼짐·짧은 글·금칙어·반복 제출을 거르고
 * 제보함에 `source: 'link'`로 넣는다. 연락처는 `private/contact`에 따로 둔다 (INB-15)
 */
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export const submitIntake = publicCallable(intakeSubmitInput, async ({ data, ip }) => {
  const token = randomBytes(16).toString('hex')
  if (data.website) return { ok: true as const, token }
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
    notify: data.notify && !!data.email,
    consent: { text: (page.get('consentText') as string | undefined)?.trim() || CONSENT_TEXT, credit: data.credit && !!data.nickname, notify: data.notify && !!data.email, at: now },
    ...(data.credit && data.nickname ? { credit: data.nickname } : {}),
    createdBy: 'intake',
    createdAt: now,
  })
  batch.set(subRef.collection('private').doc('contact'), { nickname: data.nickname, email: data.email, createdAt: now })
  batch.set(db.doc(`intakeTokens/${hashToken(token)}`), { workspaceId: ws, submissionId: subRef.id, createdAt: now })
  await batch.commit()
  return { ok: true as const, token }
})

async function lookup(token: string) {
  const db = getFirestore()
  const t = await db.doc(`intakeTokens/${hashToken(token)}`).get()
  if (!t.exists) throw new HttpsError('not-found', ERROR_KEYS.tokenNotFound)
  const ws = t.get('workspaceId') as string
  const ref = db.doc(`workspaces/${ws}/submissions/${t.get('submissionId') as string}`)
  const sub = await ref.get()
  if (!sub.exists || sub.get('deletedAt')) throw new HttpsError('not-found', ERROR_KEYS.tokenNotFound)
  const eps = await Promise.all(((sub.get('episodeIds') as string[] | undefined) ?? []).map(id => db.doc(`workspaces/${ws}/episodes/${id}`).get()))
  const published = eps.filter(e => e.exists && !e.get('deletedAt') && e.get('status') === 'published')
  return { db, ws, ref, sub, published }
}

/** INB-12·27: 제보자 확인 링크. 상태와 게시 링크만 보여 준다 */
export const intakeStatus = publicCallable(intakeTokenInput, async ({ data }) => {
  const { db, ws, sub, published } = await lookup(data.token)
  const slug = (await db.doc(`workspaces/${ws}/config/intake`).get()).get('slug') as string | undefined
  const name = slug ? ((await db.doc(`intake/${slug}`).get()).get('name') as string | undefined) ?? '' : ''
  return {
    state: submitterState(sub.get('status') as string, sub.get('withdrawn'), published.length),
    name,
    urls: published.map(e => (e.get('published.url') as string | undefined) ?? '').filter(Boolean),
  }
})

/**
 * INB-12 동의 철회. 게시 전이면 "철회됨"으로 바꾸고 본문·첨부·연락처를 지운다(연결된 에피소드는 경고).
 * 게시 후면 `withdrawn.published`만 남겨 작가에게 알린다
 */
export const withdrawIntake = publicCallable(intakeTokenInput, async ({ data }) => {
  const { db, ref, sub, published } = await lookup(data.token)
  if (sub.get('status') === 'withdrawn' || sub.get('withdrawn')) return { ok: true as const }
  const at = FieldValue.serverTimestamp()
  if (published.length) {
    await ref.update({ withdrawn: { at, published: true } })
    return { ok: true as const }
  }
  const bucket = getStorage().bucket()
  await Promise.all(((sub.get('attachments') as string[] | undefined) ?? []).map(p => bucket.file(p).delete({ ignoreNotFound: true })))
  const batch = db.batch()
  batch.update(ref, {
    status: 'withdrawn',
    withdrawn: { at, published: false },
    title: '—',
    body: '',
    attachments: [],
    maskedBody: FieldValue.delete(),
    aiSummary: FieldValue.delete(),
    credit: FieldValue.delete(),
  })
  batch.delete(ref.collection('private').doc('contact'))
  await batch.commit()
  return { ok: true as const }
})
