import { describe, expect, it } from 'vitest'
import { authorizeUrl, exchangeCode, publishImages } from './instagram'

type Call = { url: string, init?: RequestInit }
function fakeFetch(handler: (url: string, init?: RequestInit) => unknown) {
  const calls: Call[] = []
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(handler(url, init)), { status: 200 })
  }) as unknown as typeof fetch
  return { f, calls }
}

describe('authorizeUrl', () => {
  it('scope·state·redirect를 넣는다', () => {
    const u = new URL(authorizeUrl('123', 'https://a.app/settings/instagram', 'abc', ['x', 'y']))
    expect(u.searchParams.get('client_id')).toBe('123')
    expect(u.searchParams.get('scope')).toBe('x,y')
    expect(u.searchParams.get('state')).toBe('abc')
    expect(u.searchParams.get('response_type')).toBe('code')
  })
})

describe('exchangeCode', () => {
  it('짧은 토큰을 60일 토큰으로 바꾼다 (data 배열 응답도)', async () => {
    const { f, calls } = fakeFetch(url => url.includes('api.instagram.com')
      ? { data: [{ access_token: 'short', user_id: 42 }] }
      : { access_token: 'long', expires_in: 5183944 })
    const t = await exchangeCode({ appId: '1', appSecret: 's' }, 'https://r', 'code#_', f)
    expect(t).toEqual({ accessToken: 'long', expiresIn: 5183944, userId: '42' })
    expect(((calls[0]!.init!.body) as FormData).get('code')).toBe('code')
    expect(calls[1]!.url).toContain('grant_type=ig_exchange_token')
  })
})

describe('publishImages', () => {
  it('여러 장은 캐러셀 컨테이너로 묶어 게시한다', async () => {
    let n = 0
    const { f, calls } = fakeFetch((url, init) => {
      if (url.includes('status_code')) return { status_code: 'FINISHED' }
      if (url.includes('fields=permalink')) return { permalink: 'https://instagram.com/p/x' }
      if (url.endsWith('/media_publish')) return { id: 'm1' }
      return { id: `c${++n}`, body: init?.body }
    })
    const r = await publishImages('tok', 'ig', ['https://a/1.jpg', 'https://a/2.jpg'], 'cap', f, async () => {})
    expect(r).toEqual({ mediaId: 'm1', permalink: 'https://instagram.com/p/x' })
    const posts = calls.filter(c => c.init?.method === 'POST').map(c => JSON.parse(String(c.init!.body)))
    expect(posts[0]).toEqual({ image_url: 'https://a/1.jpg', is_carousel_item: true })
    expect(posts[2]).toEqual({ media_type: 'CAROUSEL', children: 'c1,c2', caption: 'cap' })
    expect(posts[3]).toEqual({ creation_id: 'c3' })
  })
  it('1장은 캡션을 넣은 단일 게시물', async () => {
    const { f, calls } = fakeFetch(url => url.includes('status_code') ? { status_code: 'FINISHED' } : url.includes('permalink') ? {} : { id: 'c1' })
    await publishImages('tok', 'ig', ['https://a/1.jpg'], 'cap', f, async () => {})
    expect(JSON.parse(String(calls[0]!.init!.body))).toEqual({ image_url: 'https://a/1.jpg', caption: 'cap' })
  })
  it('컨테이너 오류면 실패한다', async () => {
    const { f } = fakeFetch(url => url.includes('status_code') ? { status_code: 'ERROR' } : { id: 'c1' })
    await expect(publishImages('tok', 'ig', ['https://a/1.jpg'], '', f, async () => {})).rejects.toThrow('ERROR')
  })
})
