import type { AiCheckParams } from '../../../../shared/aicheck'
import type { TextPrompt } from './story'

const OUT = '문제가 있는 그림만 골라 JSON {"items":[{"index":그림 번호,"issue":"무엇이 이상한지 한국어 한 문장"}]}로만 답해. 문제가 없으면 {"items":[]}.'

/** ILL-43·REV-13: 그림은 프롬프트 앞에 순서대로 붙는다 */
export function checkPrompt(p: AiCheckParams): TextPrompt {
  const n = p.panelIds.length
  const head = `너는 인스타툰 컷 그림 검수자야. 그림 ${n}장이 순서대로 1번부터 ${n}번이야.`
  if (p.mode === 'quality') {
    return { format: 'check', system: `${head} 손가락 개수·모양, 깨진 얼굴, 이상한 팔다리, 뭉개진 글자처럼 AI 그림에서 흔한 오류만 찾아. 그림체나 취향은 지적하지 마. ${OUT}`, prompt: `그림 ${n}장을 검수해 줘.` }
  }
  return { format: 'check', system: `${head} 같은 캐릭터인데 머리색·머리 모양·의상이 다른 그림을 찾아. 표정·자세 차이는 괜찮아. ${OUT}`, prompt: `[캐릭터 설정]\n${p.characters || '(없음 — 그림끼리 비교해 줘)'}\n\n그림 ${n}장을 비교해 줘.` }
}
