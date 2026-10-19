import type { CallableRequest } from 'firebase-functions/v2/https'
import type { z } from 'zod'
import { logger } from 'firebase-functions'
import { defineBoolean } from 'firebase-functions/params'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { ERROR_KEYS } from '../../../shared/callables'

/** 운영에서 true로 설정 (docs/dev/functions.md 1절). 에뮬레이터·초기 개발은 false */
const enforceAppCheck = defineBoolean('ENFORCE_APP_CHECK', { default: false })

type Token = NonNullable<CallableRequest['auth']>['token']

export interface AuthedRequest<I> {
  uid: string
  token: Token
  data: I
}

export interface PublicRequest<I> {
  data: I
  ip: string | undefined
}

type RawRequest = Pick<CallableRequest, 'auth' | 'data'> & { rawRequest?: { ip?: string } }

function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new HttpsError('invalid-argument', ERROR_KEYS.invalidInput, parsed.error.issues)
  return parsed.data
}

async function guard<O>(run: () => Promise<O>): Promise<O> {
  try {
    return await run()
  }
  catch (error) {
    if (error instanceof HttpsError) throw error
    logger.error('callable failed', error)
    throw new HttpsError('internal', ERROR_KEYS.internal)
  }
}

export function runAuthed<S extends z.ZodType, O>(
  schema: S,
  handler: (req: AuthedRequest<z.infer<S>>) => Promise<O>,
  req: RawRequest,
): Promise<O> {
  const auth = req.auth
  if (!auth) throw new HttpsError('unauthenticated', ERROR_KEYS.unauthenticated)
  const data = parse(schema, req.data)
  return guard(() => handler({ uid: auth.uid, token: auth.token, data }))
}

export function runPublic<S extends z.ZodType, O>(
  schema: S,
  handler: (req: PublicRequest<z.infer<S>>) => Promise<O>,
  req: RawRequest,
): Promise<O> {
  const data = parse(schema, req.data)
  return guard(() => handler({ data, ip: req.rawRequest?.ip }))
}

/** 로그인 확인 + 입력 검증 + 오류 정리 */
export function authedCallable<S extends z.ZodType, O>(
  schema: S,
  handler: (req: AuthedRequest<z.infer<S>>) => Promise<O>,
) {
  return onCall({ enforceAppCheck }, req => runAuthed(schema, handler, req))
}

/** 로그인 없이 호출 (3단계 공개 제보 전용). 입력 검증 + 오류 정리만 한다 */
export function publicCallable<S extends z.ZodType, O>(
  schema: S,
  handler: (req: PublicRequest<z.infer<S>>) => Promise<O>,
) {
  return onCall({ enforceAppCheck }, req => runPublic(schema, handler, req))
}
