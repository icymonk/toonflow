// 모델 어댑터 (docs/dev/ai-jobs.md 4절)
export interface TextResult { text: string, usage: { inTokens: number, outTokens: number }, requestId: string }
/** JSON으로 받을 응답 종류 (가짜 모델은 이 값으로 고정 결과를 고른다) */
export type TextFormat = 'analysis' | 'draft' | 'titles' | 'split' | 'caption' | 'rewrite' | 'summary' | 'check' | 'suggest' | 'episodes' | 'topics' | 'ideas'
export interface TextModel {
  generate: (req: { system: string, prompt: string, format?: TextFormat, maxTokens?: number, images?: Buffer[], imageLabels?: string[] }) => Promise<TextResult>
}
export interface ImageResult { images: Buffer[], requestId: string, billedImages: number }
export interface ImageModel {
  generate: (req: { prompt: string, negative?: string, refImages?: Buffer[], size: { w: number, h: number }, n: number }) => Promise<ImageResult>
}
