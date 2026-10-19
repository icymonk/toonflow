import { z } from 'zod'

// AST-01~08 · ILL-15 · AIU-23
export const cleanupInput = z.object({ workspaceId: z.string().min(1), olderThanDays: z.number().int().min(0).max(365) })
export type CleanupInput = z.infer<typeof cleanupInput>
export const usageInput = z.object({ workspaceId: z.string().min(1) })
export type UsageInput = z.infer<typeof usageInput>

export interface Asset {
  id: string
  path: string
  name: string
  size: number
  tags: string[]
  createdBy: string
  createdAt?: { toMillis: () => number } | null
}

export const formatBytes = (n: number) =>
  n < 1024 ** 2 ? `${Math.round(n / 1024)}KB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)}MB` : `${(n / 1024 ** 3).toFixed(2)}GB`
