import { HttpsError } from 'firebase-functions/v2/https'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ERROR_KEYS } from '../../../shared/callables'
import { runAuthed, runPublic } from './callable'

const schema = z.object({ n: z.number().int() })
const auth = { uid: 'u1', token: { uid: 'u1' } } as never

async function rejection(p: Promise<unknown>) {
  const error = await p.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(HttpsError)
  return error as HttpsError
}

describe('runAuthed', () => {
  it('rejects without sign-in', async () => {
    const error = await rejection(Promise.resolve().then(() => runAuthed(schema, async () => 1, { data: { n: 1 } })))
    expect(error.code).toBe('unauthenticated')
    expect(error.message).toBe(ERROR_KEYS.unauthenticated)
  })

  it('rejects invalid input with zod issues', async () => {
    const error = await rejection(Promise.resolve().then(() => runAuthed(schema, async () => 1, { auth, data: { n: 'x' } })))
    expect(error.code).toBe('invalid-argument')
    expect(error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path: ['n'] })]))
  })

  it('passes uid and parsed data to the handler', async () => {
    const out = await runAuthed(schema, async ({ uid, data }) => `${uid}:${data.n}`, { auth, data: { n: 2, extra: true } })
    expect(out).toBe('u1:2')
  })

  it('keeps HttpsError from the handler', async () => {
    const error = await rejection(runAuthed(schema, async () => {
      throw new HttpsError('permission-denied', ERROR_KEYS.forbidden)
    }, { auth, data: { n: 1 } }))
    expect(error.code).toBe('permission-denied')
  })

  it('hides unexpected errors as internal', async () => {
    const error = await rejection(runAuthed(schema, async () => {
      throw new Error('secret detail')
    }, { auth, data: { n: 1 } }))
    expect(error.code).toBe('internal')
    expect(error.message).toBe(ERROR_KEYS.internal)
  })
})

describe('runPublic', () => {
  it('works without sign-in and exposes the caller ip', async () => {
    const out = await runPublic(schema, async ({ data, ip }) => `${ip}:${data.n}`, { data: { n: 3 }, rawRequest: { ip: '1.2.3.4' } })
    expect(out).toBe('1.2.3.4:3')
  })
})
