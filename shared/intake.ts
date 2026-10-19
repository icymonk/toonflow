import { z } from 'zod'

// 공개 제보 링크 (INB-02~06, docs/dev/data-model.md `intake/{slug}`)
export const INTAKE_LIMITS = { name: 40, intro: 300, topics: 300, question: 100, questions: 5, answer: 1000, body: 5000, minBody: 30, nickname: 20, email: 200, banned: 100, bannedWord: 30, images: 3, imageBytes: 2 * 1024 * 1024 } as const
/** INB-05: 같은 곳에서 10분에 3번까지 */
export const INTAKE_RATE = { windowMs: 10 * 60_000, max: 3 } as const
/** INB-10 기본 동의 문구. 작가가 고치는 기능은 3-D */
export const CONSENT_TEXT = '보낸 이야기를 작가가 각색해 인스타툰으로 게시해도 좋아요. 이름·학교·회사 같은 개인정보는 바꿔서 쓴다는 안내를 확인했어요.'

export const SLUG_RE = /^[a-z0-9]{8,32}$/

/** 공개 페이지 문서 (누구나 읽는다) */
export interface IntakePage {
  workspaceId: string
  enabled: boolean
  name: string
  intro: string
  topics: string
  questions: string[]
  images: boolean
}

/** 워크스페이스 안 설정 (`workspaces/{ws}/config/intake`) */
export interface IntakeConfig {
  slug: string
  bannedWords: string[]
}

export const intakeSubmitInput = z.object({
  slug: z.string().regex(SLUG_RE),
  body: z.string().trim().max(INTAKE_LIMITS.body),
  answers: z.array(z.string().trim().max(INTAKE_LIMITS.answer)).max(INTAKE_LIMITS.questions),
  nickname: z.string().trim().max(INTAKE_LIMITS.nickname),
  email: z.string().trim().max(INTAKE_LIMITS.email).regex(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  consent: z.literal(true),
  /** base64 (data: 접두어 없이) */
  images: z.array(z.string().max(Math.ceil(INTAKE_LIMITS.imageBytes * 4 / 3) + 4)).max(INTAKE_LIMITS.images),
  /** 사람에게는 보이지 않는 칸. 채워져 있으면 봇으로 보고 조용히 버린다 */
  website: z.string().max(200),
})
export type IntakeSubmitInput = z.infer<typeof intakeSubmitInput>

export function newSlug(): string {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789'
  return [...crypto.getRandomValues(new Uint8Array(12))].map(b => abc[b % abc.length]).join('')
}

/** 질문 칸 답을 본문 뒤에 붙인다. 각색에는 이 글이 넘어간다 */
export function composeBody(body: string, questions: string[], answers: string[]): string {
  const qa = questions.map((q, i) => [q, answers[i]?.trim() ?? ''] as const).filter(([, a]) => a)
  return [body.trim(), ...qa.map(([q, a]) => `[${q}]\n${a}`)].join('\n\n')
}

/** 금칙어 줄·쉼표 구분 → 목록 */
export function parseBanned(text: string): string[] {
  return [...new Set(text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean))].slice(0, INTAKE_LIMITS.banned).map(s => s.slice(0, INTAKE_LIMITS.bannedWord))
}

/** 처음 걸린 금칙어 (대소문자·띄어쓰기 무시) */
export function findBanned(text: string, words: string[]): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')
  const hay = norm(text)
  return words.find(w => norm(w) && hay.includes(norm(w))) ?? null
}

/** INB-05: 창 안 제출 시각만 남기고, 상한 미만이면 이번 시각을 더한다 */
export function rateCheck(times: number[], now: number): { ok: boolean, times: number[] } {
  const recent = times.filter(t => t > now - INTAKE_RATE.windowMs)
  return recent.length < INTAKE_RATE.max ? { ok: true, times: [...recent, now] } : { ok: false, times: recent }
}

/** 첨부 이미지 형식은 파일 머리 바이트로 확인한다 */
export function imageType(b: Uint8Array): { type: string, ext: string } | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return { type: 'image/png', ext: 'png' }
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return { type: 'image/jpeg', ext: 'jpg' }
  if (String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP') return { type: 'image/webp', ext: 'webp' }
  return null
}
