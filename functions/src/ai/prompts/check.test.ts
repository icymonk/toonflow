import { describe, expect, it } from 'vitest'
import { checkLabel, checkPrompt } from './check'

describe('AI 점검 프롬프트 (ILL-43·REV-13)', () => {
  it('labels every picture and tells the visible part of cropped cuts', () => {
    const p = checkPrompt({ mode: 'quality', panelIds: ['a', 'b'] }, [null, { x: 0.25, y: 0, w: 0.5, h: 1 }])
    expect(p.imageLabels).toEqual(['그림 1', checkLabel(2, { x: 0.25, y: 0, w: 0.5, h: 1 })])
    expect(p.imageLabels[1]).toContain('가로 25~75%')
    expect(p.system).toContain('확실히 셀 수 없으면 지적하지 마')
    expect(p.system).toContain('confidence')
  })
})
