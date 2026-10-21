import type { ImageModel, TextModel } from '../types'

// 에뮬레이터·테스트용: 비용 없이 고정 결과를 돌려준다
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64')

export const fakeText: TextModel = {
  async generate({ system, prompt, format }) {
    const scenes = Array.from({ length: Number(`${system}${prompt}`.match(/(\d+)장짜리/)?.[1] ?? 6) }, (_, i) => ({ heading: `장면 ${i + 1}`, beats: `${i + 1}번째 일이 일어난다`, dialogues: [{ speaker: '나', type: 'speech', text: `대사 ${i + 1}` }] }))
    const canned = {
      analysis: { summary: ['한 줄', '두 줄', '세 줄'], characters: [{ name: '부장님', role: '상사' }], points: ['반전'], sensitive: [] },
      draft: { titles: ['가짜 제목'], logline: '가짜 로그라인', scenes, punchline: '끝' },
      split: { pages: scenes.map((sc, i) => ({ panels: [{ scene: sc.beats, place: '사무실', characters: ['나'], shot: i === 0 ? 'wide' : 'bust', expression: '', action: '', outfit: '', mood: '', dialogues: sc.dialogues }] })) },
      titles: { titles: ['제목 1', '제목 2', '제목 3', '제목 4', '제목 5'] },
      caption: { caption: '가짜 캡션 본문', hashtags: ['#인스타툰', '#공감툰'] },
      rewrite: { text: '가짜 다시 쓰기' },
      suggest: { options: ['가짜 추천 1', '가짜 추천 2', '가짜 추천 3'] },
      summary: { summary: ['첫째 줄', '둘째 줄', '셋째 줄'], genre: 'comedy', score: 72, reason: '반전이 뚜렷해요' },
      check: { items: [{ index: 1, issue: '가짜 점검: 손 모양이 어색해 보여요' }] },
      episodes: { parts: [{ title: '가짜 1화', text: prompt.slice(0, Math.ceil(prompt.length / 2)) || '앞', hook: '가짜 끊는 지점' }, { title: '가짜 2화', text: prompt.slice(Math.ceil(prompt.length / 2)) || '뒤', hook: '' }] },
    }
    return { text: JSON.stringify(format ? canned[format] : { echo: prompt.slice(0, 200) }), usage: { inTokens: prompt.length, outTokens: 50 }, requestId: `fake-${Date.now()}` }
  },
}

export const fakeImage: ImageModel = {
  async generate({ n }) {
    return { images: Array.from({ length: n }, () => PNG_1PX), requestId: `fake-${Date.now()}`, billedImages: n }
  },
}
