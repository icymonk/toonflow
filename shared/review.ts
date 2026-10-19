import type { CheckIssue } from './render'

// REV-10·14·15 검수 목록
export type ReviewState = 'unchecked' | 'needs' | 'pass'
export const REVIEW_STATES: ReviewState[] = ['unchecked', 'needs', 'pass']
export const REVIEW_ITEMS = ['images', 'dialogues', 'bubbles', 'typo', 'privacy', 'credit', 'aiLabel'] as const
export type ReviewItem = (typeof REVIEW_ITEMS)[number]
export interface ChecklistRow { key: string, state: ReviewState, auto: boolean, custom?: string }

const AUTO: Partial<Record<ReviewItem, (issues: CheckIssue[], aiLabel: boolean) => boolean>> = {
  images: is => !is.some(i => i.kind === 'noImage'),
  dialogues: is => !is.some(i => i.kind === 'noBubble'),
  bubbles: is => !is.some(i => i.kind === 'outside' || i.kind === 'smallText'),
  privacy: is => !is.some(i => i.kind === 'pii'),
  aiLabel: (_, on) => on,
}

/** 자동 항목은 문제가 없으면 통과, 있으면 확인 필요(작가가 직접 통과로 바꿀 수 있음. 그림 없는 컷은 제외) */
export function checklist(issues: CheckIssue[], aiLabel: boolean, stored: Record<string, ReviewState> = {}, custom: string[] = []): ChecklistRow[] {
  const rows: ChecklistRow[] = REVIEW_ITEMS.map((key) => {
    const ok = AUTO[key]
    if (!ok) return { key, state: stored[key] ?? 'unchecked', auto: false }
    if (ok(issues, aiLabel)) return { key, state: 'pass', auto: true }
    return { key, state: key !== 'images' && stored[key] === 'pass' ? 'pass' : 'needs', auto: true }
  })
  return [...rows, ...custom.map(c => ({ key: `custom:${c}`, state: stored[`custom:${c}`] ?? 'unchecked', auto: false, custom: c }))]
}
export const reviewLeft = (rows: ChecklistRow[]) => rows.filter(r => r.state !== 'pass').length
