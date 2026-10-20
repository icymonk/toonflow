import { describe, expect, it } from 'vitest'
import { prevEpisodeSummary, previousEpisode, sceneDiff, storyContext } from './story'

describe('story quality helpers', () => {
  it('builds context from memo and character voices', () => {
    expect(storyContext(' 회사 배경 ', [{ name: '민지', personality: '직설적', speech: ['됐거든?', ''] }, { name: '부장' }]))
      .toBe('작품 메모: 회사 배경\n민지: 성격 직설적 / 말투 예: "됐거든?"')
    expect(storyContext('', [])).toBe('')
    expect(storyContext('메모', [], '지난 화(1화) 줄거리:\n요약 x')).toBe('작품 메모: 메모\n지난 화(1화) 줄거리:\n요약 x')
  })
  it('summarizes the closest earlier episode with a story', () => {
    const eps = [
      { id: 'a', number: 1, activeStoryVersionId: 'v1' },
      { id: 'b', number: 2, activeStoryVersionId: 'v2', deletedAt: { s: 1 } },
      { id: 'c', number: 3, activeStoryVersionId: null },
      { id: 'd', number: 4, activeStoryVersionId: 'v4' },
      { id: 'e', number: 5, activeStoryVersionId: 'v5' },
    ]
    expect(previousEpisode(eps, { id: 'd', number: 4 })?.id).toBe('a')
    expect(previousEpisode(eps, { id: 'a', number: 1 })).toBeNull()
    const v = { logline: ' 첫 출근 ', punchline: '알고 보니 사장', scenes: [{ id: 's', heading: '로비', beats: '지각', dialogues: [] }, { id: 't', heading: '', beats: '', dialogues: [] }] }
    expect(prevEpisodeSummary({ number: 1, title: '시작' }, v)).toBe('지난 화(1화 "시작") 줄거리:\n요약 첫 출근\n1. 로비 — 지각\n마무리 알고 보니 사장')
    expect(prevEpisodeSummary({ number: 1, title: '' }, { logline: '', punchline: '', scenes: [] })).toBe('')
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
