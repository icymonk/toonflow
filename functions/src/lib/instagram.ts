// PUB-24: Instagram API with Instagram Login (business login, content publishing)
export type Fetch = typeof fetch
const GRAPH = 'https://graph.instagram.com'
const VERSION = 'v26.0'

export class InstagramError extends Error {}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({})) as T & { error?: { message?: string } | string, error_message?: string }
  if (!res.ok) {
    const e = body.error
    throw new InstagramError(`instagram ${res.status}: ${typeof e === 'string' ? e : e?.message ?? body.error_message ?? ''}`)
  }
  return body
}

export interface AppCreds { appId: string, appSecret: string }
export interface Token { accessToken: string, expiresIn: number }

export function authorizeUrl(appId: string, redirectUri: string, state: string, scopes: readonly string[]) {
  const q = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, response_type: 'code', scope: scopes.join(','), state, enable_fb_login: 'false' })
  return `https://www.instagram.com/oauth/authorize?${q}`
}

/** 코드 → 짧은 토큰 → 60일 토큰 */
export async function exchangeCode(c: AppCreds, redirectUri: string, code: string, f: Fetch = fetch): Promise<Token & { userId: string }> {
  const form = new FormData()
  for (const [k, v] of Object.entries({ client_id: c.appId, client_secret: c.appSecret, grant_type: 'authorization_code', redirect_uri: redirectUri, code: code.replace(/#_$/, '') })) form.append(k, v)
  const short = await json<{ access_token?: string, user_id?: string | number, data?: { access_token: string, user_id: string | number }[] }>(await f('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form }))
  const s = short.data?.[0] ?? short
  if (!s.access_token) throw new InstagramError('instagram: no access_token')
  const q = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: c.appSecret, access_token: s.access_token })
  const long = await json<{ access_token: string, expires_in: number }>(await f(`${GRAPH}/access_token?${q}`))
  return { accessToken: long.access_token, expiresIn: long.expires_in, userId: String(s.user_id) }
}

export async function refreshToken(accessToken: string, f: Fetch = fetch): Promise<Token> {
  const q = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: accessToken })
  const r = await json<{ access_token: string, expires_in: number }>(await f(`${GRAPH}/refresh_access_token?${q}`))
  return { accessToken: r.access_token, expiresIn: r.expires_in }
}

export async function me(accessToken: string, f: Fetch = fetch): Promise<{ userId: string, username: string }> {
  const r = await json<{ user_id?: string | number, id?: string, username: string }>(await f(`${GRAPH}/${VERSION}/me?fields=user_id,username`, { headers: { Authorization: `Bearer ${accessToken}` } }))
  return { userId: String(r.user_id ?? r.id), username: r.username }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
/** 단계별 진행 (대기열 패널 진행 막대) */
export type Progress = (step: 'prepare' | 'process' | 'publish', done: number, total: number) => unknown

/** 이미지 1장은 단일 게시물, 2장 이상은 캐러셀. 컨테이너가 FINISHED가 될 때까지 기다린 뒤 게시하고 링크를 돌려준다 */
export async function publishImages(accessToken: string, igId: string, imageUrls: string[], caption: string, f: Fetch = fetch, wait = sleep, progress: Progress = () => {}): Promise<{ mediaId: string, permalink: string }> {
  const post = async (path: string, body: Record<string, unknown>) => json<{ id: string }>(await f(`${GRAPH}/${VERSION}/${path}`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }))
  const ready = async (id: string) => {
    for (let i = 0; i < 30; i++) {
      const s = await json<{ status_code?: string }>(await f(`${GRAPH}/${VERSION}/${id}?fields=status_code`, { headers: { Authorization: `Bearer ${accessToken}` } }))
      if (s.status_code === 'FINISHED' || s.status_code === 'PUBLISHED') return
      if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new InstagramError(`instagram container ${s.status_code}`)
      await wait(2000)
    }
    throw new InstagramError('instagram container timeout')
  }
  let creation: string
  if (imageUrls.length === 1) {
    creation = (await post(`${igId}/media`, { image_url: imageUrls[0], caption })).id
  }
  else {
    const children: string[] = []
    for (const url of imageUrls) {
      await progress('prepare', children.length, imageUrls.length)
      children.push((await post(`${igId}/media`, { image_url: url, is_carousel_item: true })).id)
    }
    for (const [k, id] of children.entries()) {
      await progress('process', k, children.length)
      await ready(id)
    }
    creation = (await post(`${igId}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption })).id
  }
  await progress('process', imageUrls.length, imageUrls.length)
  await ready(creation)
  await progress('publish', 0, 1)
  const mediaId = (await post(`${igId}/media_publish`, { creation_id: creation })).id
  const p = await json<{ permalink?: string }>(await f(`${GRAPH}/${VERSION}/${mediaId}?fields=permalink`, { headers: { Authorization: `Bearer ${accessToken}` } }))
  return { mediaId, permalink: p.permalink ?? '' }
}
