import type { ErrorKey } from '#shared/callables'
import { ko } from '../locales/ko'

const IGNORED = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])

type ErrorText = keyof typeof ko.errors

const byCode: Record<string, ErrorText> = {
  'auth/popup-blocked': 'popupBlocked',
  'auth/invalid-email': 'invalidEmail',
  'auth/invalid-action-code': 'linkExpired',
  'auth/expired-action-code': 'linkExpired',
  'auth/network-request-failed': 'network',
  'functions/unavailable': 'network',
}

/** 서버 기능은 메시지 키(ERROR_KEYS)를 돌려준다 */
const byKey: Record<ErrorKey, ErrorText> = {
  'error.unauthenticated': 'signInAgain',
  'error.invalidInput': 'invalidInput',
  'error.internal': 'unknown',
  'error.notAllowed': 'notAllowed',
  'error.notMember': 'notMember',
  'error.forbidden': 'forbidden',
  'error.limitExceeded': 'limitExceeded',
  'error.seriesNotEmpty': 'seriesNotEmpty',
  'error.modelUnavailable': 'modelUnavailable',
  'error.intakeClosed': 'intakeClosed',
  'error.tooShort': 'tooShort',
  'error.bannedWord': 'bannedWord',
  'error.tooMany': 'tooMany',
  'error.tokenNotFound': 'tokenNotFound',
}

/** Firebase·서버 오류를 화면 문구로. 사용자가 닫은 팝업 등은 null */
export function errorMessage(error: unknown): string | null {
  const code = (error as { code?: string })?.code ?? ''
  if (IGNORED.has(code)) return null
  const message = (error as { message?: string })?.message ?? ''
  const key = Object.keys(byKey).find(k => message.startsWith(k)) as ErrorKey | undefined
  const text = (key && byKey[key]) ?? byCode[code] ?? 'unknown'
  return ko.errors[text]
}
