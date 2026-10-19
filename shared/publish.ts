import { AI_CAPTION } from './render'

// PUB-10·11·12 캡션 조합: 고정 인사말 → 본문 → 해시태그(AI 후보 + 작품 고정) → 제보자 크레딧 → AI 이용 표기
export const splitTags = (s: string) => s.split(/[\s,]+/).map(t => t.replace(/^#+/, '').trim()).filter(Boolean).map(t => `#${t}`)

export interface CaptionParts { greeting?: string, text?: string, hashtags?: string[], fixedTags?: string, credit?: string, aiLabel: boolean }
export function composeCaption(p: CaptionParts): string {
  const tags = [...new Set([...splitTags((p.hashtags ?? []).join(' ')), ...splitTags(p.fixedTags ?? '')])]
  return [p.greeting?.trim(), p.text?.trim(), tags.join(' '), p.credit?.trim(), p.aiLabel ? AI_CAPTION : ''].filter(Boolean).join('\n\n')
}
