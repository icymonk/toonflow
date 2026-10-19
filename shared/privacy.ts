// INB-13·REV-12: 개인정보로 보이는 부분 찾기 (규칙 기반, 놓치는 것이 있을 수 있음)
export type PiiKind = 'name' | 'phone' | 'email' | 'address' | 'school' | 'company'
export interface PiiHit { kind: PiiKind, start: number, end: number, text: string, suggestion: string }

const RULES: [PiiKind, RegExp][] = [
  ['email', /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g],
  ['phone', /(?:\+82[- ]?)?0\d{1,2}[- .]?\d{3,4}[- .]?\d{4}/g],
  ['address', /[가-힣]{1,10}(?:시|도)\s?[가-힣]{1,10}(?:구|군)\s?[가-힣\d]{1,12}(?:동|읍|면|로|길)(?:\s?\d{1,5}(?:-\d{1,5})?)?/g],
  ['school', /[가-힣]{2,10}(?:초등학교|중학교|고등학교|대학교|여고|여중)/g],
  ['company', /[가-힣A-Za-z]{2,10}(?:전자|그룹|컴퍼니|주식회사)|(?:주식회사|㈜)\s?[가-힣A-Za-z]{2,10}/g],
  ['name', /[가-힣]{2,3}(?=씨|님)/g],
]
// "부장님", "아저씨"처럼 호칭이 이름으로 잡히지 않게
const NOT_NAMES = new Set(['부장', '과장', '차장', '대리', '팀장', '사장', '실장', '이사', '선생', '고객', '손님', '기사', '교수', '원장', '아저', '아가', '형', '누나', '언니', '오빠', '여러분', '회장', '반장', '주임', '작가', '사모', '고모', '이모', '삼촌', '할머', '할아버', '어머', '아버', '따님', '아드'])
const LABEL: Record<Exclude<PiiKind, 'name'>, string> = { phone: '(전화번호)', email: '(이메일)', address: '(주소)', school: 'OO학교', company: 'OO회사' }

export function findPii(text: string): PiiHit[] {
  const raw: Omit<PiiHit, 'suggestion'>[] = []
  for (const [kind, re] of RULES) {
    for (const m of text.matchAll(re)) {
      if (kind === 'name' && NOT_NAMES.has(m[0])) continue
      raw.push({ kind, start: m.index!, end: m.index! + m[0].length, text: m[0] })
    }
  }
  raw.sort((a, b) => a.start - b.start || b.end - a.end)
  const names = new Map<string, string>()
  const out: PiiHit[] = []
  let last = -1
  for (const h of raw) {
    if (h.start < last) continue
    last = h.end
    if (h.kind === 'name' && !names.has(h.text)) names.set(h.text, String.fromCharCode(65 + (names.size % 26)))
    out.push({ ...h, suggestion: h.kind === 'name' ? names.get(h.text)! : LABEL[h.kind] })
  }
  return out
}

/** INB-14: 찾은 부분을 바꾼 글 */
export function applyMask(text: string, hits: PiiHit[]): string {
  let s = text
  for (const h of [...hits].sort((a, b) => b.start - a.start)) s = s.slice(0, h.start) + h.suggestion + s.slice(h.end)
  return s
}
