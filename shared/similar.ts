/** INB-26 비슷한 제보: 공백·대소문자를 무시한 2글자 조각의 Jaccard 유사도 */
export const SIMILAR = { threshold: 0.6, minLength: 20 } as const

function grams(s: string): Set<string> {
  const t = s.replace(/\s+/g, '').toLowerCase()
  const g = new Set<string>()
  for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2))
  return g
}

function jaccard(x: Set<string>, y: Set<string>): number {
  if (!x.size || !y.size) return 0
  let n = 0
  for (const g of x) if (y.has(g)) n++
  return n / (x.size + y.size - n)
}

export const similarity = (a: string, b: string) => jaccard(grams(a), grams(b))

/** id → 비슷한 다른 제보 id들. 너무 짧은 글은 빼고 본다 */
export function similarGroups(items: { id: string, body: string }[]): Map<string, string[]> {
  const ok = items.filter(i => i.body.replace(/\s+/g, '').length >= SIMILAR.minLength).map(i => ({ id: i.id, g: grams(i.body) }))
  const out = new Map<string, string[]>()
  const push = (a: string, b: string) => out.set(a, [...(out.get(a) ?? []), b])
  for (let i = 0; i < ok.length; i++) {
    for (let j = i + 1; j < ok.length; j++) {
      if (jaccard(ok[i]!.g, ok[j]!.g) >= SIMILAR.threshold) {
        push(ok[i]!.id, ok[j]!.id)
        push(ok[j]!.id, ok[i]!.id)
      }
    }
  }
  return out
}
