// 모델 어댑터 (docs/dev/ai-jobs.md 4절)
export interface TextResult { text: string, usage: { inTokens: number, outTokens: number }, requestId: string }
export interface TextModel {
  generate: (req: { system: string, prompt: string, maxTokens?: number }) => Promise<TextResult>
}
export interface ImageResult { images: Buffer[], requestId: string, billedImages: number }
export interface ImageModel {
  generate: (req: { prompt: string, negative?: string, refImages?: Buffer[], size: { w: number, h: number }, n: number }) => Promise<ImageResult>
}
