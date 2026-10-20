// 가입 허용 목록(config/access.allowedEmails)에 이메일 넣기·빼기
// 사용: GOOGLE_APPLICATION_CREDENTIALS=서비스계정.json node functions/scripts/allow-email.mjs you@example.com [--remove]
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const [raw, flag] = process.argv.slice(2)
const email = raw?.trim().toLowerCase()
if (!email) {
  console.error('usage: node functions/scripts/allow-email.mjs <email> [--remove]')
  process.exit(1)
}
initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'toonflow-351ed' })
const remove = flag === '--remove'
await getFirestore().doc('config/access').set(
  { allowedEmails: remove ? FieldValue.arrayRemove(email) : FieldValue.arrayUnion(email) },
  { merge: true },
)
console.log(`${email}: 가입 허용 ${remove ? '해제' : '추가'}`)
