// PUB-25: Threads API (graph.threads.com). 문서: developers.facebook.com/docs/threads
export type Fetch = typeof fetch
const GRAPH = 'https://graph.threads.com'
const VERSION = 'v1.0'

export class ThreadsError extends Error {}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({})) as T & { error?: { message?: string } | string, error_message?: string }
  if (!res.ok) {
    const e = body.error
    throw new ThreadsError(`threads ${res.status}: ${typeof e === 'string' ? e : e?.message ?? body.error_message ?? ''}`)
  }
  return body
}

export interface AppCreds { appId: string, appSecret: string }
export interface Token { accessToken: string, expiresIn: number }

export function authorizeUrl(appId: string, redirectUri: string, state: string, scopes: readonly string[]) {
  const q = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, scope: scopes.join(','), response_type: 'code', state })
  return `https://threads.com/oauth/authorize?${q}`
}

/** 코드 → 짧은 토큰 → 60일 토큰 */
export async function exchangeCode(c: AppCreds, redirectUri: string, code: string, f: Fetch = fetch): Promise<Token & { userId: string }> {
  const body = new URLSearchParams({ client_id: c.appId, client_secret: c.appSecret, grant_type: 'authorization_code', redirect_uri: redirectUri, code: code.replace(/#_$/, '') })
  const s = await json<{ access_token?: string, user_id?: string | number }>(await f(`${GRAPH}/oauth/access_token`, { method: 'POST', body }))
  if (!s.access_token) throw new ThreadsError('threads: no access_token')
  const q = new URLSearchParams({ grant_type: 'th_exchange_token', client_secret: c.appSecret, access_token: s.access_token })
  const long = await json<{ access_token: string, expires_in: number }>(await f(`${GRAPH}/access_token?${q}`))
  return { accessToken: long.access_token, expiresIn: long.expires_in, userId: String(s.user_id) }
}

export async function refreshToken(accessToken: string, f: Fetch = fetch): Promise<Token> {
  const q = new URLSearchParams({ grant_type: 'th_refresh_token', access_token: accessToken })
  const r = await json<{ access_token: string, expires_in: number }>(await f(`${GRAPH}/refresh_access_token?${q}`))
  return { accessToken: r.access_token, expiresIn: r.expires_in }
}

export async function me(accessToken: string, f: Fetch = fetch): Promise<{ userId: string, username: string }> {
  const q = new URLSearchParams({ fields: 'id,username', access_token: accessToken })
  const r = await json<{ id: string, username: string }>(await f(`${GRAPH}/${VERSION}/me?${q}`))
  return { userId: String(r.id), username: r.username }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
/** 단계별 진행 (대기열 패널 진행 막대) */
export type Progress = (step: 'prepare' | 'process' | 'publish', done: number, total: number) => unknown

/** 1장은 IMAGE, 2장 이상은 CAROUSEL. 컨테이너가 FINISHED가 될 때까지 기다린 뒤 게시하고 링크를 돌려준다 */
export async function publishImages(accessToken: string, userId: string, imageUrls: string[], text: string, f: Fetch = fetch, wait = sleep, progress: Progress = () => {}): Promise<{ mediaId: string, permalink: string }> {
  const post = async (path: string, params: Record<string, string>) =>
    json<{ id: string }>(await f(`${GRAPH}/${VERSION}/${path}`, { method: 'POST', body: new URLSearchParams({ ...params, access_token: accessToken }) }))
  const get = async <T>(path: string, fields: string) => json<T>(await f(`${GRAPH}/${VERSION}/${path}?${new URLSearchParams({ fields, access_token: accessToken })}`))
  const ready = async (id: string) => {
    for (let i = 0; i < 40; i++) {
      const s = await get<{ status?: string, error_message?: string }>(id, 'status,error_message')
      if (s.status === 'FINISHED' || s.status === 'PUBLISHED') return
      if (s.status === 'ERROR' || s.status === 'EXPIRED') throw new ThreadsError(`threads container ${s.status} ${s.error_message ?? ''}`.trim())
      await wait(3000)
    }
    throw new ThreadsError('threads container timeout')
  }
  let creation: string
  if (imageUrls.length === 1) {
    creation = (await post(`${userId}/threads`, { media_type: 'IMAGE', image_url: imageUrls[0]!, text })).id
  }
  else {
    const children: string[] = []
    for (const url of imageUrls) {
      await progress('prepare', children.length, imageUrls.length)
      children.push((await post(`${userId}/threads`, { media_type: 'IMAGE', image_url: url, is_carousel_item: 'true' })).id)
    }
    for (const [k, id] of children.entries()) {
      await progress('process', k, children.length)
      await ready(id)
    }
    creation = (await post(`${userId}/threads`, { media_type: 'CAROUSEL', children: children.join(','), text })).id
  }
  await progress('process', imageUrls.length, imageUrls.length)
  await ready(creation)
  await progress('publish', 0, 1)
  const mediaId = (await post(`${userId}/threads_publish`, { creation_id: creation })).id
  const p = await get<{ permalink?: string }>(mediaId, 'permalink')
  return { mediaId, permalink: p.permalink ?? '' }
}
