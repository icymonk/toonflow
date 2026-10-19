import type { ImageModel, TextModel } from '../types'

// 에뮬레이터·테스트용: 비용 없이 고정 결과를 돌려준다
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64')

export const fakeText: TextModel = {
  async generate({ prompt }) {
    return { text: JSON.stringify({ echo: prompt.slice(0, 200) }), usage: { inTokens: prompt.length, outTokens: 50 }, requestId: `fake-${Date.now()}` }
  },
}

export const fakeImage: ImageModel = {
  async generate({ n }) {
    return { images: Array.from({ length: n }, () => PNG_1PX), requestId: `fake-${Date.now()}`, billedImages: n }
  },
}
