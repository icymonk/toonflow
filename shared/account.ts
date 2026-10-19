import { z } from 'zod'

export const completeOnboardingInput = z.object({})
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingInput>

export interface CompleteOnboardingOutput {
  workspaceId: string
}

/** ACC-10: 내 워크스페이스 기본 이름 */
export function defaultWorkspaceName(displayName: string | null | undefined, email: string | null | undefined): string {
  const name = displayName?.trim() || email?.split('@')[0] || '나'
  return `${name}의 스튜디오`
}

/** ACC-02: 0~3단계 가입 허용 목록. 대소문자 무시 */
export function isAllowedEmail(email: string | null | undefined, allowed: readonly string[]): boolean {
  if (!email) return false
  const e = email.trim().toLowerCase()
  return allowed.some(a => a.trim().toLowerCase() === e)
}
