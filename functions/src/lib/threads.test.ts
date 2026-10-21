import { describe, expect, it } from 'vitest'
import { authorizeUrl, exchangeCode, publishImages } from './threads'

type Call = { url: string, init?: RequestInit }
function fakeFetch(handler: (url: string, init?: RequestInit) => unknown) {
  const calls: Call[] = []
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(handler(url, init)), { status: 200 })
  }) as unknown as typeof fetch
  return { f, calls }
}
const form = (c: Call) => Object.fromEntries(new URLSearchParams(String(c.init!.body)))

describe('threads', () => {
  it('authorizeUrl은 threads.com 인증 창', () => {
    const u = new URL(authorizeUrl('1', 'https://r', 's', ['threads_basic']))
    expect(u.host).toBe('threads.com')
    expect(u.searchParams.get('scope')).toBe('threads_basic')
  })
  it('exchangeCode: 짧은 토큰 → th_exchange_token', async () => {
    const { f, calls } = fakeFetch(url => url.includes('/oauth/') ? { access_token: 's', user_id: 7 } : { access_token: 'l', expires_in: 100 })
    expect(await exchangeCode({ appId: '1', appSecret: 'x' }, 'https://r', 'c#_', f)).toEqual({ accessToken: 'l', expiresIn: 100, userId: '7' })
    expect(form(calls[0]!).code).toBe('c')
    expect(calls[1]!.url).toContain('grant_type=th_exchange_token')
  })
  it('여러 장은 캐러셀로 묶어 게시한다', async () => {
    let n = 0
    const { f, calls } = fakeFetch((url) => {
      if (url.includes('fields=status')) return { status: 'FINISHED' }
      if (url.includes('fields=permalink')) return { permalink: 'https://www.threads.com/@a/post/x' }
      if (url.includes('threads_publish')) return { id: 'm1' }
      return { id: `c${++n}` }
    })
    const r = await publishImages('tok', 'u', ['https://a/1.jpg', 'https://a/2.jpg'], '글', f, async () => {})
    expect(r).toEqual({ mediaId: 'm1', permalink: 'https://www.threads.com/@a/post/x' })
    const posts = calls.filter(c => c.init?.method === 'POST').map(form)
    expect(posts[0]).toMatchObject({ media_type: 'IMAGE', image_url: 'https://a/1.jpg', is_carousel_item: 'true' })
    expect(posts[2]).toMatchObject({ media_type: 'CAROUSEL', children: 'c1,c2', text: '글' })
    expect(posts[3]).toMatchObject({ creation_id: 'c3' })
  })
  it('컨테이너 오류면 실패한다', async () => {
    const { f } = fakeFetch(url => url.includes('fields=status') ? { status: 'ERROR', error_message: 'bad' } : { id: 'c1' })
    await expect(publishImages('tok', 'u', ['https://a/1.jpg'], '', f, async () => {})).rejects.toThrow('ERROR bad')
  })
})
