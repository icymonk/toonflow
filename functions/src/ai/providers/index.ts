import type { ModelEntry } from '../../../../shared/config'
import type { ImageModel, TextModel } from '../types'
import { AiError } from '../errors'
import { fakeImage, fakeText } from './fake'

/** config/models의 provider → 어댑터 (docs/dev/ai-jobs.md 4절). 실제 제공사는 S1·S2 뒤에 추가 */
const TEXT: Record<string, TextModel> = { fake: fakeText }
const IMAGE: Record<string, ImageModel> = { fake: fakeImage }

export function textModel(m: ModelEntry): TextModel {
  const a = TEXT[m.provider]
  if (!a) throw new AiError('internal', `no text adapter for provider ${m.provider}`)
  return a
}

export function imageModel(m: ModelEntry): ImageModel {
  const a = IMAGE[m.provider]
  if (!a) throw new AiError('internal', `no image adapter for provider ${m.provider}`)
  return a
}
