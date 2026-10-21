/** PUB-24·25 SNS 게시 작업 `workspaces/{ws}/socialPosts/{id}` (멤버가 읽고 서버만 쓴다). AIU-01 대기열 패널에도 보인다 */
export const SOCIAL_PLATFORMS = ['instagram', 'threads'] as const
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]
export const SOCIAL_NAMES: Record<SocialPlatform, string> = { instagram: 'Instagram', threads: 'Threads' }
export type SocialStatus = 'queued' | 'running' | 'succeeded' | 'failed'
/** prepare: 장마다 컨테이너 만들기, process: Meta 처리 기다리기, publish: 게시 */
export type SocialStep = 'prepare' | 'process' | 'publish'
export interface SocialProgress { step: SocialStep, done: number, total: number }
type Ts = { toMillis: () => number }
export interface SocialPost {
  id: string
  platform: SocialPlatform
  episodeId: string
  status: SocialStatus
  progress?: SocialProgress | null
  url?: string
  error?: string
  createdAt?: Ts
  startedAt?: Ts
  finishedAt?: Ts
}
/** 진행 막대 비율 (0~1). 준비 단계가 대부분이라 준비 80%, 처리 15%, 게시 5% */
export function socialRatio(p: SocialProgress | null | undefined): number {
  if (!p || !p.total) return 0
  const f = Math.min(1, p.done / p.total)
  return p.step === 'prepare' ? f * 0.8 : p.step === 'process' ? 0.8 + f * 0.15 : 0.95 + f * 0.05
}
