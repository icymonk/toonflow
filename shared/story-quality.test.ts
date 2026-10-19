import { describe, expect, it } from 'vitest'
import { sceneDiff, storyContext } from './story'

describe('story quality helpers', () => {
  it('builds context from memo and character voices', () => {
    expect(storyContext(' 회사 배경 ', [{ name: '민지', personality: '직설적', speech: ['됐거든?', ''] }, { name: '부장' }]))
      .toBe('작품 메모: 회사 배경\n민지: 성격 직설적 / 말투 예: "됐거든?"')
    expect(storyContext('', [])).toBe('')
  })
  it('marks changed headings, beats and lines', () => {
    const sc = (heading: string, beats: string, text: string) => ({ id: heading, heading, beats, dialogues: [{ speaker: '나', type: 'speech' as const, text }] })
    const rows = sceneDiff({ scenes: [sc('출근', '지각', '안녕'), sc('끝', '퇴근', '바이')] }, { scenes: [sc('출근', '지각함', '안녕')] })
    expect(rows).toHaveLength(2)
    expect(rows[0]!.a).toMatchObject({ headingChanged: false, beatsChanged: true })
    expect(rows[0]!.a!.lines.every(l => !l.changed)).toBe(true)
    expect(rows[1]!.b).toBeNull()
    expect(rows[1]!.a!.lines[0]!.changed).toBe(true)
  })
})
