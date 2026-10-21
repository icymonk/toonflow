import { z } from 'zod'
import { connectInstagramInput, IG_MAX_ITEMS, instagramWorkspaceInput } from './instagram'

export { exportPathOk, igPostingActive, needsRefresh } from './instagram'
export type { InstagramInfo as ThreadsInfo } from './instagram'

/** PUB-25: Threads 계정 연결·바로 게시. 장 수·토큰 수명은 Instagram과 같다(최대 20장, 60일) */
export const TH_SCOPES = ['threads_basic', 'threads_content_publish'] as const
export const TH_MAX_ITEMS = IG_MAX_ITEMS
export const TH_TEXT_MAX = 500
export const TH_CALLBACK_PATH = '/settings/threads'
/** Meta 앱의 Threads 리디렉션 콜백 URL과 글자까지 같아야 한다 */
export const TH_REDIRECT_URI = `https://toonflow-studio.web.app${TH_CALLBACK_PATH}`

/** Threads 글자 수: 이모지는 UTF-8 바이트 수로 센다 */
const EMOJI = /\p{Extended_Pictographic}/u
const enc = new TextEncoder()
export const threadsLength = (s: string) => [...s].reduce((n, ch) => n + (EMOJI.test(ch) ? enc.encode(ch).length : 1), 0)
/** 500자를 넘으면 끝을 자르고 …를 붙인다 */
export function threadsText(caption: string, max = TH_TEXT_MAX): string {
  if (threadsLength(caption) <= max) return caption
  let out = ''
  for (const ch of caption) {
    if (threadsLength(out + ch) > max - 1) break
    out += ch
  }
  return `${out.trimEnd()}…`
}

export const threadsWorkspaceInput = instagramWorkspaceInput
export type ThreadsWorkspaceInput = z.infer<typeof threadsWorkspaceInput>
export const connectThreadsInput = connectInstagramInput
export type ConnectThreadsInput = z.infer<typeof connectThreadsInput>
export const publishThreadsInput = z.object({
  workspaceId: z.string().min(1).max(40),
  episodeId: z.string().min(1).max(40),
  paths: z.array(z.string().max(300)).min(1).max(TH_MAX_ITEMS),
  caption: z.string().max(2000).refine(s => threadsLength(s) <= TH_TEXT_MAX),
})
export type PublishThreadsInput = z.infer<typeof publishThreadsInput>
