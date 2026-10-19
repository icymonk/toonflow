import type { ModelEntry } from '../../../../shared/config'
import type { ImageModel, TextModel } from '../types'
import { AiError } from '../errors'
import { fakeImage, fakeText } from './fake'
import { geminiImage, geminiText } from './gemini'

/** config/models의 provider → 어댑터 (docs/dev/ai-jobs.md 4절) */
const TEXT: Record<string, (m: ModelEntry) => TextModel> = { fake: () => fakeText, gemini: m => geminiText(m) }
const IMAGE: Record<string, (m: ModelEntry) => ImageModel> = { fake: () => fakeImage, gemini: m => geminiImage(m) }

export function textModel(m: ModelEntry): TextModel {
  const a = TEXT[m.provider]
  if (!a) throw new AiError('internal', `no text adapter for provider ${m.provider}`)
  return a(m)
}

export function imageModel(m: ModelEntry): ImageModel {
  const a = IMAGE[m.provider]
  if (!a) throw new AiError('internal', `no image adapter for provider ${m.provider}`)
  return a(m)
}
