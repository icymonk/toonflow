import { z } from 'zod'

/** ILL-43 일관성 점검 · REV-13 이미지 품질 점검 (AI, 선택) */
export const AI_CHECK_MODES = ['quality', 'consistency'] as const
export type AiCheckMode = (typeof AI_CHECK_MODES)[number]
/** 한 번에 넘기는 컷 수 상한 (요청 크기) */
export const AI_CHECK_MAX = 12
/** 모델에 한 번에 보여 주는 그림 수. 많이 넣으면 번호가 섞이고 작은 부분을 놓친다 */
export const AI_CHECK_BATCH = 4
/** 그림 한 장을 글자 수로 친 값 (비용 예상용, 고해상도로 보낸다) */
export const IMAGE_CHARS = 1200

export const aiCheckParams = z.object({
  mode: z.enum(AI_CHECK_MODES),
  panelIds: z.array(z.string().min(1).max(40)).min(1).max(AI_CHECK_MAX),
  characters: z.string().max(4000).nullish(),
})
export type AiCheckParams = z.infer<typeof aiCheckParams>

export const CHECK_CONFIDENCE = ['high', 'medium', 'low'] as const
export const aiCheckSchema = z.object({ items: z.array(z.object({ index: z.number().int(), issue: z.string(), confidence: z.enum(CHECK_CONFIDENCE).optional() })) })
export type AiCheckRaw = z.infer<typeof aiCheckSchema>['items'][number]

export interface AiCheckItem { panelId: string, issue: string }
export interface AiCheck { mode: AiCheckMode, items: AiCheckItem[], count: number, jobId: string, at?: unknown }

/** 모델이 돌려준 그림 번호(1부터)를 컷 id로. 범위 밖·빈 지적, 확신이 높지 않은 지적은 버린다 */
export function mapCheckItems(panelIds: string[], items: AiCheckRaw[]): AiCheckItem[] {
  return items
    .filter(i => i.index >= 1 && i.index <= panelIds.length && i.issue.trim() && (i.confidence ?? 'high') === 'high')
    .map(i => ({ panelId: panelIds[i.index - 1]!, issue: i.issue.trim().slice(0, 200) }))
    .slice(0, 40)
}

/** 비용 예상에 더할 그림 몫 */
export const checkInputChars = (params: Record<string, unknown>) => (Array.isArray(params.panelIds) ? params.panelIds.length : 0) * IMAGE_CHARS

/** 묶음별 결과(묶음 안 번호)를 전체 번호로 합친다 */
export function mergeCheckBatches(batches: AiCheckRaw[][], size = AI_CHECK_BATCH): AiCheckRaw[] {
  return batches.flatMap((items, b) => items.filter(i => i.index >= 1 && i.index <= size).map(i => ({ ...i, index: i.index + b * size })))
}
