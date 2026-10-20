import type { JobType } from '../../../../shared/jobs'
import type { StoryParams } from '../../../../shared/story'
import type { TextFormat } from '../types'
import { storyParams } from '../../../../shared/story'
import { AiError } from '../errors'
import { guard } from './guard'

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

const split = (p: StoryParams): TextPrompt => ({
  format: 'split',
  system: `너는 인스타툰 콘티 작가야. 각색안을 ${p.pageCount}장짜리 인스타툰 콘티로 나눠. pages는 정확히 ${p.pageCount}개, 장마다 panels 1~4개(기본 1컷, 대사가 많거나 빠른 전개면 2컷). 마지막 장은 펀치라인 1컷. `
    + 'scene은 그림 AI가 그릴 장면 설명(누가, 어디서, 무엇을. 글자·말풍선은 넣지 않는다), place는 장소·시간, characters는 등장인물 이름, '
    + 'shot은 closeup|bust|full|wide|pov 중 하나, expression·action·outfit은 주인공의 표정·동작·의상, mood는 분위기·효과(집중선, 땀방울 등). '
    + `dialogues는 그 컷의 대사(한 개에 40자 이내). ${LINE_TYPES} `
    + '반드시 JSON만: {"pages": [{"panels": [{"scene": str, "place": str, "characters": [str], "shot": str, "expression": str, "action": str, "outfit": str, "mood": str, "dialogues": [{"speaker": str, "type": str, "text": str}]}]}]}',
  prompt: p.draft || p.material,
})

// STO-13
const MODE_KO = { rewrite: '새롭게 다시 써', shorter: '뜻은 그대로 두고 더 짧게 줄여', funnier: '더 웃기게 고쳐', tone: '', refine: '그림 AI가 그리기 좋게 구체적인 장면 묘사(장소·시간·조명·인물 배치·구도)로 바꿔. 글자·말풍선 내용은 넣지 않는다' } as const
const rewrite = (p: StoryParams): TextPrompt => {
  const r = p.rewrite
  if (!r) throw new AiError('internal', 'rewrite params missing')
  const how = r.mode === 'tone' ? `말투를 "${r.tone || '자연스러운 구어체'}"로 바꿔` : MODE_KO[r.mode]
  return {
    format: 'rewrite',
    system: `너는 인스타툰 각색 작가야. 각색안 전체를 참고해서 [고칠 부분]만 ${how}. 대사라면 한 줄에 하나씩 "[종류] 화자: 대사" 형식을 지킨다. 반드시 JSON만: {"text": str}`,
    prompt: `${p.draft || p.material}\n\n[고칠 부분]\n${r.text}`,
  }
}

// 추천 입력
const SUGGEST_KO = {
  logline: ['한 줄 요약', '이 화 전체를 한 문장으로, 60자 이내'],
  heading: ['장면 제목', '장면을 짧게 부르는 제목, 20자 이내'],
  beats: ['장면 내용', '이 장면에서 일어나는 일을 1~3문장으로. 대사는 넣지 않는다'],
  punchline: ['마무리', '마지막 장의 펀치라인 한 문장, 40자 이내'],
} as const
const suggest = (p: StoryParams): TextPrompt => {
  const s = p.suggest
  if (!s) throw new AiError('internal', 'suggest params missing')
  const [name, rule] = SUGGEST_KO[s.field]
  return {
    format: 'suggest',
    system: `너는 인스타툰 각색 작가야. 각색안 전체를 참고해서 [${name}]에 넣을 후보를 서로 다른 느낌으로 3개 써. ${rule}. 실명·특정 가능한 정보는 쓰지 않는다. 반드시 JSON만: {"options": [str, str, str]}`,
    prompt: `${p.draft || p.material}${s.scene ? `\n\n[이 장면]\n${s.scene}` : ''}\n\n[지금 ${name}]\n${s.text.trim() || '(비어 있음)'}`,
  }
}

// PUB-10
const caption = (p: StoryParams): TextPrompt => ({
  format: 'caption',
  system: '너는 인스타툰 작가야. 각색안을 읽고 인스타그램 게시물 캡션을 써. 2~4문장, 공감을 부르는 말투, 결말 스포일러 금지, 마지막 문장은 댓글을 부르는 질문. '
    + 'hashtags는 한국어 해시태그 후보 8~12개(#포함). 실명·특정 가능한 정보는 쓰지 않는다. 반드시 JSON만: {"caption": str, "hashtags": [str]}',
  prompt: p.draft || p.material,
})

const BUILDERS: Partial<Record<JobType, (p: StoryParams) => TextPrompt>> = { 'story.analyze': analyze, 'story.draft': draft, 'story.titles': titles, 'storyboard.split': split, 'publish.caption': caption, 'story.rewrite': rewrite, 'story.suggest': suggest }

// INB-23
const summarize = (material: string): TextPrompt => ({
  format: 'summary',
  system: '너는 인스타툰 편집자야. 제보 썰을 읽고 세 줄로 요약해. genre는 empathy(공감)|comedy(코믹)|touching(감동)|cider(사이다)|horror(공포)|info(정보) 중 가장 어울리는 톤 하나. '
    + 'score는 6장 안팎 인스타툰으로 만들었을 때의 재미·공감·반전 기준 웹툰 거리 점수(0~100 정수), reason은 점수 이유 한 문장. 실명·특정 가능한 정보는 요약에 쓰지 않는다. '
    + '반드시 JSON만: {"summary": [str, str, str], "genre": str, "score": int, "reason": str}',
  prompt: material,
})

/** 글 작업 프롬프트. 아직 처리기가 없는 종류는 params를 그대로 보낸다 */
export function textPrompt(type: JobType, params: Record<string, unknown>): TextPrompt {
  return guard(buildPrompt(type, params))
}

function buildPrompt(type: JobType, params: Record<string, unknown>): TextPrompt {
  if (type === 'submission.summary') return summarize(String(params.material ?? '').slice(0, 20000))
  const build = BUILDERS[type]
  if (!build) return { system: '', prompt: JSON.stringify(params) }
  const p = storyParams.safeParse(params)
  if (!p.success) throw new AiError('internal', `bad params for ${type}`)
  const out = build(p.data)
  // STO-03
  return p.data.context ? { ...out, prompt: `${out.prompt}\n\n[작품 참고 — 설정·캐릭터 말투]\n${p.data.context}` } : out
}
