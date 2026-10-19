import type { CompleteOnboardingInput, CompleteOnboardingOutput } from './account'
import type { JobRefInput, StartAiJobInput } from './jobs'
import type { SetWorkspaceLimitInput } from './usage'

/** 서버 기능 오류 메시지 키. 화면 문구는 app/locales/ko.ts의 errors에서 키로 찾는다 */
export const ERROR_KEYS = {
  unauthenticated: 'error.unauthenticated',
  invalidInput: 'error.invalidInput',
  internal: 'error.internal',
  notAllowed: 'error.notAllowed',
  notMember: 'error.notMember',
  forbidden: 'error.forbidden',
  limitExceeded: 'error.limitExceeded',
  modelUnavailable: 'error.modelUnavailable',
} as const

export type ErrorKey = (typeof ERROR_KEYS)[keyof typeof ERROR_KEYS]

/** callable 이름 → 입력·출력 타입. 새 callable을 만들면 여기에 등록한다 (docs/dev/functions.md 2절) */
export interface Callables {
  completeOnboarding: { input: CompleteOnboardingInput, output: CompleteOnboardingOutput }
  setWorkspaceLimit: { input: SetWorkspaceLimitInput, output: { ok: true } }
  startAiJob: { input: StartAiJobInput, output: { jobId: string } }
  cancelAiJob: { input: JobRefInput, output: { ok: true } }
  retryAiJob: { input: JobRefInput, output: { ok: true } }
}
