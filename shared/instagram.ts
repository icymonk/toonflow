import { z } from 'zod'

/** PUB-24: Instagram 비즈니스 로그인으로 연결한 계정에 바로 게시 (본인 계정·테스터 단계) */
export const IG_SCOPES = ['instagram_business_basic', 'instagram_business_content_publish'] as const
/** 캐러셀 최대 장 수, 캡션 최대 글자 수 */
export const IG_MAX_ITEMS = 20
export const IG_CAPTION_MAX = 2200
export const IG_CALLBACK_PATH = '/settings/instagram'
/** Meta 앱의 OAuth 리디렉션 URI와 글자까지 같아야 한다 */
/** 게시 중 표시가 이보다 오래되면 멈춘 것으로 보고 다시 게시할 수 있게 한다 */
export const IG_POST_STALE_MS = 10 * 60_000
export const igPostingActive = (post: { status?: string, at?: { toMillis: () => number } | null } | null | undefined, now: number) =>
  post?.status === 'posting' && now - (post.at?.toMillis() ?? now) < IG_POST_STALE_MS
export const IG_REDIRECT_URI = `https://toonflow-studio.web.app${IG_CALLBACK_PATH}`
/** 만료 20일 전부터 갱신. 발급 24시간이 지나야 갱신된다 */
const DAY = 86_400_000
export const needsRefresh = (expiresAt: number, issuedAt: number, now: number) => now - issuedAt >= DAY && expiresAt - now <= 20 * DAY && expiresAt > now

const ws = z.string().min(1).max(40)
export const instagramWorkspaceInput = z.object({ workspaceId: ws })
export type InstagramWorkspaceInput = z.infer<typeof instagramWorkspaceInput>
export const connectInstagramInput = z.object({ workspaceId: ws, code: z.string().min(1).max(2000), state: z.string().regex(/^[a-f0-9]{32}$/) })
export type ConnectInstagramInput = z.infer<typeof connectInstagramInput>
/** 경로는 `workspaces/{ws}/exports/{episodeId}/` 아래 JPG */
export const publishInstagramInput = z.object({
  workspaceId: ws,
  episodeId: z.string().min(1).max(40),
  paths: z.array(z.string().max(300)).min(1).max(IG_MAX_ITEMS),
  caption: z.string().max(IG_CAPTION_MAX),
})
export type PublishInstagramInput = z.infer<typeof publishInstagramInput>
export const exportPathOk = (p: string, wsId: string, episodeId: string) =>
  p.startsWith(`workspaces/${wsId}/exports/${episodeId}/`) && /^[\w/-]+\.jpg$/.test(p) && !p.includes('..')

/** 워크스페이스 문서 `instagram` (누구나 볼 수 있는 연결 정보. 토큰은 서버만) */
export interface InstagramInfo { userId: string, username: string, expiresAt: number, connectedAt: number }
