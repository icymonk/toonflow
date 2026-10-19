import { z } from 'zod'

// 제보함 (docs/features/inbox.md, glossary 3절)
export const SUBMISSION_STATUSES = ['new', 'reviewing', 'accepted', 'onHold', 'rejected', 'used', 'withdrawn'] as const
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]
/** 작가가 직접 고를 수 있는 상태. used는 에피소드 연결, withdrawn은 제보자 철회로만 바뀐다 */
export const MANUAL_STATUSES = ['new', 'reviewing', 'accepted', 'onHold', 'rejected'] as const satisfies readonly SubmissionStatus[]

export const SUBMISSION_SOURCES = ['dm', 'comment', 'form', 'self', 'other', 'link'] as const
export type SubmissionSource = (typeof SUBMISSION_SOURCES)[number]
/** INB-01 직접 등록에서 고르는 출처 (link는 3단계 제보 링크) */
export const MANUAL_SOURCES = ['dm', 'comment', 'form', 'self', 'other'] as const satisfies readonly SubmissionSource[]

export const LIMITS = { title: 80, body: 20000, note: 2000, sourceNote: 200, tag: 20, tags: 10 } as const

export const submissionInput = z.object({
  title: z.string().trim().min(1).max(LIMITS.title),
  body: z.string().trim().min(1).max(LIMITS.body),
  source: z.enum(MANUAL_SOURCES),
  sourceNote: z.string().trim().max(LIMITS.sourceNote),
  tags: z.array(z.string().trim().min(1).max(LIMITS.tag)).max(LIMITS.tags),
})
export type SubmissionInput = z.infer<typeof submissionInput>

export interface Submission extends Omit<SubmissionInput, 'source'> {
  id: string
  source: SubmissionSource
  status: SubmissionStatus
  starred: boolean
  note: string
  episodeIds: string[]
  maskedBody?: string | null
  aiSummary?: import('./story').SubmissionSummary & { jobId: string }
  createdBy: string
  createdAt?: { toMillis: () => number }
  deletedAt?: unknown
}

/** 제목이 비면 본문 첫 줄 (INB-01) */
export function titleFrom(title: string, body: string): string {
  const t = title.trim() || body.trim().split('\n')[0]!.trim()
  return t.length > LIMITS.title ? `${t.slice(0, LIMITS.title - 1)}…` : t
}

/** 여러 개 붙여 넣기: `---`만 있는 줄로 나눈다 (INB-01) */
export function splitBulk(text: string): string[] {
  return text.split(/^\s*-{3,}\s*$/m).map(s => s.trim()).filter(Boolean)
}

export function parseTags(text: string): string[] {
  return [...new Set(text.split(/[,#\s]+/).map(s => s.trim()).filter(Boolean))].slice(0, LIMITS.tags).map(s => s.slice(0, LIMITS.tag))
}

export interface SubmissionFilter { status: SubmissionStatus | 'all', source: SubmissionSource | 'all', tag: string, q: string, starred: boolean, days: number }

/** INB-20: 상태·출처·태그·기간·검색 */
export function filterSubmissions(list: Submission[], f: SubmissionFilter, now = Date.now()): Submission[] {
  const q = f.q.trim().toLowerCase()
  return list.filter(s =>
    !s.deletedAt
    && (f.status === 'all' || s.status === f.status)
    && (f.source === 'all' || s.source === f.source)
    && (!f.tag || s.tags.includes(f.tag))
    && (!f.starred || s.starred)
    && (!f.days || (s.createdAt?.toMillis() ?? now) >= now - f.days * 86_400_000)
    && (!q || `${s.title}\n${s.body}\n${s.note}\n${s.tags.join(' ')}`.toLowerCase().includes(q)))
}

/** INB-21 키보드: A 채택, H 보류, R 반려 */
export const STATUS_KEYS: Record<string, SubmissionStatus> = { a: 'accepted', h: 'onHold', r: 'rejected' }
