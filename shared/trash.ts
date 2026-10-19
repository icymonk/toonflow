import { z } from 'zod'

// CMN-30 휴지통
export const TRASH_KINDS = ['episode', 'series', 'submission', 'character', 'style'] as const
export type TrashKind = (typeof TRASH_KINDS)[number]
export const TRASH_COLLECTION: Record<TrashKind, string> = { episode: 'episodes', series: 'series', submission: 'submissions', character: 'characters', style: 'styles' }
export const TRASH_DAYS = 30
const DAY = 86_400_000
export const daysLeft = (deletedMs: number, now: number) => Math.max(0, TRASH_DAYS - Math.floor((now - deletedMs) / DAY))
export const trashCutoff = (now: number) => now - TRASH_DAYS * DAY
export const trashItemInput = z.object({
  workspaceId: z.string().min(1),
  kind: z.enum(TRASH_KINDS),
  id: z.string().min(1),
})
export type TrashItemInput = z.infer<typeof trashItemInput>
