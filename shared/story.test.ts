import { describe, expect, it } from 'vitest'
import { dialoguesToText, draftSchema, materialToScenes, parseJson, summarySchema, textToDialogues } from './story'

describe('parseJson', () => {
  it('accepts fenced JSON and fills defaults', () => {
    const d = parseJson(draftSchema, '```json\n{"scenes":[{"heading":"h","beats":"b","dialogues":[{"speaker":"민지","type":"yell","text":"앗"}]}]}\n```')
    expect(d?.scenes[0]?.dialogues[0]).toEqual({ speaker: '민지', type: 'speech', text: '앗' })
    expect(d?.titles).toEqual([])
  })
  it('returns null on invalid output', () => {
    expect(parseJson(draftSchema, 'not json')).toBeNull()
    expect(parseJson(draftSchema, '{"scenes":[]}')).toBeNull()
  })
})

describe('dialogue text', () => {
  it('round-trips labels and speakers', () => {
    const lines = [
      { type: 'speech' as const, speaker: '민지', text: '안녕' },
      { type: 'thought' as const, speaker: '민지', text: '망했다' },
      { type: 'narration' as const, speaker: '', text: '그날 밤' },
      { type: 'sfx' as const, speaker: '', text: '쾅' },
    ]
    expect(textToDialogues(dialoguesToText(lines))).toEqual(lines)
    expect(textToDialogues('부장님：이거 뭐야\n\n그냥 문장')).toEqual([
      { type: 'speech', speaker: '부장님', text: '이거 뭐야' },
      { type: 'narration', speaker: '', text: '그냥 문장' },
    ])
  })
})

describe('summarySchema', () => {
  it('falls back for unknown genre and out-of-range score', () => {
    expect(parseJson(summarySchema, '{"summary":["a","b","c"],"genre":"romance","score":150,"reason":"r"}')).toEqual({ summary: ['a', 'b', 'c'], genre: 'empathy', score: 50, reason: 'r' })
  })
})

describe('materialToScenes', () => {
  it('one scene per paragraph, at most 20', () => {
    expect(materialToScenes('첫 문단\n둘째 줄\n\n---\n\n  다음 문단  ')).toEqual([
      { id: 's1', heading: '장면 1', beats: '첫 문단\n둘째 줄', dialogues: [] },
      { id: 's2', heading: '장면 2', beats: '다음 문단', dialogues: [] },
    ])
    const many = materialToScenes(Array.from({ length: 25 }, (_, i) => `p${i}`).join('\n\n'))
    expect(many).toHaveLength(20)
    expect(many[19]!.beats).toBe('p19\n\np20\n\np21\n\np22\n\np23\n\np24')
  })
})
