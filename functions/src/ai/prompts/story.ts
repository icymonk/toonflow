import type { JobType } from '../../../../shared/jobs'
import type { StoryParams } from '../../../../shared/story'
import type { TextFormat } from '../types'
import { storyParams } from '../../../../shared/story'
import { AiError } from '../errors'

const TONE_KO = { empathy: '공감', comedy: '코믹', touching: '감동', cider: '사이다', horror: '공포', info: '정보' } as const
const LINE_TYPES = '대사 type은 speech(말), thought(생각), whisper(속삭임), shout(외침), narration(내레이션), sfx(효과음) 중 하나.'

export interface TextPrompt { system: string, prompt: string, format?: TextFormat }

const analyze = (p: StoryParams): TextPrompt => ({
  format: 'analysis',
  system: '너는 인스타툰 편집자야. 제보 썰을 읽고 각색 전에 분석해. '
    + 'summary는 3줄 요약, characters는 등장인물(name: 썰에 나온 호칭, role: 관계), points는 웃음·반전·공감 포인트, '
    + 'sensitive는 실명·특정 가능한 정보(회사·학교·지역+나이 등)·혐오 표현(text: 해당 부분, reason: 이유). '
    + '반드시 JSON만: {"summary": [str], "characters": [{"name": str, "role": str}], "points": [str], "sensitive": [{"text": str, "reason": str}]}',
  prompt: p.material,
})

const draft = (p: StoryParams): TextPrompt => ({
  format: 'draft',
  system: `너는 인스타툰 각색 작가야. 제보 썰을 ${p.pageCount}장짜리 인스타툰으로 각색해. 장면 하나가 한 장이라 scenes는 정확히 ${p.pageCount}개. `
    + `톤: ${TONE_KO[p.tone]}. 화자: ${p.narrator === 'first' ? '작가 본인 1인칭' : '제보자 이야기를 전하는 3인칭'}. 구어체, 한국 인스타툰 말투. `
    + '실명·특정 가능한 정보는 바꿔서 쓴다. 마지막 장면은 펀치라인으로 마무리. '
    + `heading은 장면 제목, beats는 무슨 일이 일어나는지 1~2문장, dialogues는 그 장면의 대사. ${LINE_TYPES} `
    + 'titles는 제목 후보 3개(15자 이내), logline은 한 줄 요약. '
    + '반드시 JSON만: {"titles": [str], "logline": str, "scenes": [{"heading": str, "beats": str, "dialogues": [{"speaker": str, "type": str, "text": str}]}], "punchline": str}',
  prompt: [p.material, p.extraRequest && `추가 요청: ${p.extraRequest}`].filter(Boolean).join('\n\n'),
})

const titles = (p: StoryParams): TextPrompt => ({
  format: 'titles',
  system: '너는 인스타툰 편집자야. 각색안을 읽고 인스타그램에서 눈에 띄는 제목 후보 5개를 만들어. 15자 이내, 스포일러 금지. 반드시 JSON만: {"titles": [str]}',
  prompt: p.draft || p.material,
})

const BUILDERS: Partial<Record<JobType, (p: StoryParams) => TextPrompt>> = { 'story.analyze': analyze, 'story.draft': draft, 'story.titles': titles }

/** 글 작업 프롬프트. 아직 처리기가 없는 종류는 params를 그대로 보낸다 */
export function textPrompt(type: JobType, params: Record<string, unknown>): TextPrompt {
  const build = BUILDERS[type]
  if (!build) return { system: '', prompt: JSON.stringify(params) }
  const p = storyParams.safeParse(params)
  if (!p.success) throw new AiError('internal', `bad params for ${type}`)
  return build(p.data)
}
