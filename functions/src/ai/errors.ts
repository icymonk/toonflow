import type { JobError, JobErrorCode } from '../../../shared/jobs'
import { MAX_ATTEMPTS } from '../../../shared/jobs'

/** 어댑터가 분류를 알고 있을 때 던진다 */
export class AiError extends Error {
  constructor(readonly code: JobErrorCode, message: string) {
    super(message)
  }
}

/** AIU-05: 어떤 오류든 작업 오류 코드로 */
export function classify(e: unknown): JobError {
  const err = e as { status?: unknown, code?: unknown, name?: unknown, message?: unknown } | undefined
  let code: JobErrorCode = 'internal'
  if (e instanceof AiError) code = e.code
  else {
    const status = typeof err?.status === 'number' ? err.status : typeof err?.code === 'number' ? err.code : undefined
    if (status === 429) code = 'rate_limited'
    else if (status !== undefined && status >= 500) code = 'provider_error'
    else if (err?.name === 'AbortError' || err?.name === 'TimeoutError' || err?.code === 'ETIMEDOUT' || err?.code === 'ECONNRESET') code = 'provider_error'
  }
  const message = String(err?.message ?? e).slice(0, 500)
  return { code, message, retryable: MAX_ATTEMPTS[code] > 1 }
}

/** 이번 실행(1부터)이 이 오류의 마지막 시도인지 */
export function isLastAttempt(code: JobErrorCode, attempt: number): boolean {
  return attempt >= MAX_ATTEMPTS[code]
}
