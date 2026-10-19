import { z } from 'zod'

/** ACC-11, AIU-31, EPI-01: 워크스페이스 기본값 (docs/dev/data-model.md) */
export const workspaceDefaults = z.object({
  aspect: z.enum(['4:5', '1:1', '3:4']),
  pageCount: z.number().int().min(1).max(20),
  candidateCount: z.number().int().min(1).max(4),
  storyDraftCount: z.number().int().min(1).max(3),
  narrator: z.enum(['first', 'third']),
})
export type WorkspaceDefaults = z.infer<typeof workspaceDefaults>

export const DEFAULT_WORKSPACE_DEFAULTS: WorkspaceDefaults = {
  aspect: '4:5',
  pageCount: 6,
  candidateCount: 2,
  storyDraftCount: 1,
  narrator: 'first',
}

export const workspaceSettingsInput = z.object({
  name: z.string().trim().min(1).max(40),
  defaults: workspaceDefaults,
})
export type WorkspaceSettingsInput = z.infer<typeof workspaceSettingsInput>

/** 저장된 값이 비었거나 일부만 있어도 기본값으로 채운다 */
export function withDefaults(saved: Partial<WorkspaceDefaults> | undefined): WorkspaceDefaults {
  return { ...DEFAULT_WORKSPACE_DEFAULTS, ...saved }
}
