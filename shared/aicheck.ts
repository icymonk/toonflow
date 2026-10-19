import { z } from 'zod'

/** ILL-43 일관성 점검 · REV-13 이미지 품질 점검 (AI, 선택) */
export const AI_CHECK_MODES = ['quality', 'consistency'] as const
export type AiCheckMode = (typeof AI_CHECK_MODES)[number]
/** 한 번에 넘기는 컷 수 상한 (요청 크기) */
export const AI_CHECK_MAX = 12
/** 그림 한 장을 글자 수로 친 값 (비용 예상용) */
export const IMAGE_CHARS = 300

export const aiCheckParams = z.object({
  mode: z.enum(AI_CHECK_MODES),
  panelIds: z.array(z.string().min(1).max(40)).min(1).max(AI_CHECK_MAX),
  characters: z.string().max(4000).nullish(),
})
export type AiCheckParams = z.infer<typeof aiCheckParams>

export const aiCheckSchema = z.object({ items: z.array(z.object({ index: z.number().int(), issue: z.string() })) })

export interface AiCheckItem { panelId: string, issue: string }
export interface AiCheck { mode: AiCheckMode, items: AiCheckItem[], count: number, jobId: string, at?: unknown }

/** 모델이 돌려준 그림 번호(1부터)를 컷 id로. 범위 밖·빈 지적은 버린다 */
export function mapCheckItems(panelIds: string[], items: { index: number, issue: string }[]): AiCheckItem[] {
  return items
    .filter(i => i.index >= 1 && i.index <= panelIds.length && i.issue.trim())
    .map(i => ({ panelId: panelIds[i.index - 1]!, issue: i.issue.trim().slice(0, 200) }))
    .slice(0, 40)
}

/** 비용 예상에 더할 그림 몫 */
export const checkInputChars = (params: Record<string, unknown>) => (Array.isArray(params.panelIds) ? params.panelIds.length : 0) * IMAGE_CHARS
