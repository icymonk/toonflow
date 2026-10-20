import type { AiCheckParams } from '../../../../shared/aicheck'
import type { Crop } from '../../../../shared/studio'
import type { TextPrompt } from './story'
import { guard } from './guard'

const OUT = '문제가 있는 그림만 골라 JSON {"items":[{"index":그림 번호,"issue":"어느 부분이 어떻게 이상한지 한국어 한 문장","confidence":"high|medium|low"}]}로만 답해. '
  + '눈으로 바로 확인될 만큼 분명하면 high, 아니면 medium이나 low야. 문제가 없으면 {"items":[]}가 정답이야.'

const pct = (v: number) => Math.round(v * 100)
/** 그림 앞에 붙는 표시. 컷에서 일부만 쓰면 보이는 범위를 알려 준다 */
export function checkLabel(n: number, crop?: Crop | null): string {
  const part = crop && (crop.w < 0.99 || crop.h < 0.99)
    ? ` (컷에는 가로 ${pct(crop.x)}~${pct(crop.x + crop.w)}%, 세로 ${pct(crop.y)}~${pct(crop.y + crop.h)}% 부분만 보여. 그 밖은 보지 마)`
    : ''
  return `그림 ${n}${part}`
}

/** ILL-43·REV-13: 그림마다 앞에 "그림 N" 표시를 붙여 한 묶음(AI_CHECK_BATCH)씩 보낸다 */
export function checkPrompt(p: AiCheckParams, crops: (Crop | null | undefined)[]): TextPrompt & { imageLabels: string[] } {
  const n = crops.length
  const imageLabels = crops.map((c, i) => checkLabel(i + 1, c))
  const head = `너는 인스타툰 컷 그림 검수자야. 그림 ${n}장이 있고, 각 그림 바로 앞에 "그림 1"부터 "그림 ${n}"까지 표시가 있어. index는 그 번호야.`
  if (p.mode === 'quality') {
    return {
      ...guard({ format: 'check', system: `${head} AI 그림에서 흔한 큰 오류만 찾아: 손가락·발가락 개수가 분명히 틀림, 깨진 얼굴, 붙거나 없어진 팔다리, 뭉개진 글자. `
        + '작거나 가려지거나 흐릿해서 개수·모양을 확실히 셀 수 없으면 지적하지 마. 만화식으로 단순하게 그린 손(손가락 4개 등)과 그림체·취향도 지적하지 마. '
        + OUT, prompt: `그림 ${n}장을 검수해 줘.` }),
      imageLabels,
    }
  }
  return {
    ...guard({ format: 'check', system: `${head} 같은 캐릭터인데 머리색·머리 모양·의상이 분명히 다른 그림을 찾아. 표정·자세·각도 차이는 괜찮아. ${OUT}`, prompt: `[캐릭터 설정]\n${p.characters || '(없음 — 그림끼리 비교해 줘)'}\n\n그림 ${n}장을 비교해 줘.` }),
    imageLabels,
  }
}
