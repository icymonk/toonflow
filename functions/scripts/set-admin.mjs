// 운영자 권한(admin 커스텀 클레임) 주기 (docs/dev/README.md R9)
// 사용: GOOGLE_APPLICATION_CREDENTIALS=서비스계정.json node functions/scripts/set-admin.mjs you@example.com [--remove]
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const [email, flag] = process.argv.slice(2)
if (!email) {
  console.error('usage: node functions/scripts/set-admin.mjs <email> [--remove]')
  process.exit(1)
}
initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'toonflow-351ed' })
const user = await getAuth().getUserByEmail(email)
const admin = flag !== '--remove'
await getAuth().setCustomUserClaims(user.uid, { ...user.customClaims, admin })
console.log(`${email}: admin=${admin}. 다시 로그인하면 적용돼요.`)
