import { randomBytes } from 'node:crypto'
import { logger } from 'firebase-functions'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import { HttpsError } from 'firebase-functions/v2/https'
import { ERROR_KEYS } from '../../../shared/callables'
import { connectInstagramInput, exportPathOk, IG_REDIRECT_URI, IG_SCOPES, igPostingActive, instagramWorkspaceInput, publishInstagramInput } from '../../../shared/instagram'
import { requireMember } from '../lib/authz'
import { authedCallable } from '../lib/callable'
import { authorizeUrl, exchangeCode, InstagramError, me } from '../lib/instagram'

/** Meta 앱 대시보드 → Instagram → API setup with Instagram login의 앱 ID·시크릿. GitHub 시크릿 → deploy.yml이 Secret Manager로 옮긴다 */
export const INSTAGRAM_APP_ID = defineSecret('INSTAGRAM_APP_ID')
export const INSTAGRAM_APP_SECRET = defineSecret('INSTAGRAM_APP_SECRET')
const secrets = [INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET]
const STATE_TTL_MS = 10 * 60_000

function creds() {
  const appId = INSTAGRAM_APP_ID.value().trim()
  const appSecret = INSTAGRAM_APP_SECRET.value().trim()
  if (!appId || !appSecret || appId === 'unset' || appSecret === 'unset') throw new HttpsError('failed-precondition', ERROR_KEYS.instagramNotConfigured)
  return { appId, appSecret }
}

function igFailed(e: unknown): never {
  if (e instanceof HttpsError) throw e
  logger.warn('instagram failed', { e: String(e) })
  throw new HttpsError(e instanceof InstagramError ? 'failed-precondition' : 'internal', ERROR_KEYS.instagramFailed)
}

/** PUB-24: 연결 시작. CSRF 방지용 state는 서버에 10분 둔다 (`instagramStates/{state}`, 규칙 없음 = 서버만) */
export const instagramAuthUrl = authedCallable(instagramWorkspaceInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'admin')
  const { appId } = creds()
  const state = randomBytes(16).toString('hex')
  await getFirestore().doc(`instagramStates/${state}`).set({ workspaceId: data.workspaceId, uid, expiresAt: Date.now() + STATE_TTL_MS })
  return { url: authorizeUrl(appId, IG_REDIRECT_URI, state, IG_SCOPES) }
}, { secrets })

/** 돌아온 코드를 60일 토큰으로 바꿔 `instagramTokens/{ws}`(서버만)에 두고, 계정 이름만 워크스페이스 문서에 남긴다 */
export const connectInstagram = authedCallable(connectInstagramInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'admin')
  const c = creds()
  const db = getFirestore()
  const stateRef = db.doc(`instagramStates/${data.state}`)
  const st = await stateRef.get()
  await stateRef.delete()
  if (!st.exists || st.get('uid') !== uid || st.get('workspaceId') !== data.workspaceId || st.get('expiresAt') < Date.now()) throw new HttpsError('failed-precondition', ERROR_KEYS.invalidInput)
  try {
    const t = await exchangeCode(c, IG_REDIRECT_URI, data.code)
    const acct = await me(t.accessToken)
    const now = Date.now()
    const expiresAt = now + t.expiresIn * 1000
    await db.doc(`instagramTokens/${data.workspaceId}`).set({ accessToken: t.accessToken, userId: acct.userId, issuedAt: now, expiresAt, by: uid })
    await db.doc(`workspaces/${data.workspaceId}`).update({ instagram: { userId: acct.userId, username: acct.username, expiresAt, connectedAt: now } })
    return { username: acct.username }
  }
  catch (e) { igFailed(e) }
}, { secrets })

export const disconnectInstagram = authedCallable(instagramWorkspaceInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'admin')
  const db = getFirestore()
  await db.doc(`instagramTokens/${data.workspaceId}`).delete()
  await db.doc(`workspaces/${data.workspaceId}`).update({ instagram: FieldValue.delete() })
  return { ok: true as const }
})

/** 브라우저가 그려 올린 장 JPG로 게시를 접수만 한다. 실제 게시는 postInstagram 트리거가 한다
 * (Hosting `/fn` 경유 호출은 60초에 끊겨서, 캐러셀 처리를 기다리면 화면에는 실패로 보인다) */
export const publishInstagram = authedCallable(publishInstagramInput, async ({ uid, data }) => {
  await requireMember(data.workspaceId, uid, 'editor')
  if (!data.paths.every(p => exportPathOk(p, data.workspaceId, data.episodeId))) throw new HttpsError('invalid-argument', ERROR_KEYS.invalidInput)
  const db = getFirestore()
  const tok = await db.doc(`instagramTokens/${data.workspaceId}`).get()
  if (!tok.exists || tok.get('expiresAt') < Date.now()) throw new HttpsError('failed-precondition', ERROR_KEYS.instagramNotConnected)
  const epRef = db.doc(`workspaces/${data.workspaceId}/episodes/${data.episodeId}`)
  await db.runTransaction(async (tx) => {
    const ep = await tx.get(epRef)
    if (!ep.exists) throw new HttpsError('not-found', ERROR_KEYS.invalidInput)
    if (igPostingActive(ep.get('instagramPost'), Date.now())) throw new HttpsError('failed-precondition', ERROR_KEYS.instagramBusy)
    tx.update(epRef, { instagramPost: { status: 'posting', at: FieldValue.serverTimestamp(), by: uid } })
    tx.create(db.collection('instagramPosts').doc(), { workspaceId: data.workspaceId, episodeId: data.episodeId, paths: data.paths, caption: data.caption, by: uid, createdAt: FieldValue.serverTimestamp() })
  })
  return { ok: true as const }
})
