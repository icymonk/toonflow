import { describe, expect, it } from 'vitest'
import { confirmDialog, dialogQueue, promptDialog, settleDialog } from './useDialog'

describe('useDialog', () => {
  it('resolves confirm and prompt in order', async () => {
    const a = confirmDialog('지울까요?')
    const b = promptDialog('이름', '기본')
    expect(dialogQueue.value.map(r => r.message)).toEqual(['지울까요?', '이름'])
    settleDialog(dialogQueue.value[0]!, true)
    expect(await a).toBe(true)
    settleDialog(dialogQueue.value[0]!, '새 이름')
    expect(await b).toBe('새 이름')
    expect(dialogQueue.value).toEqual([])
  })

  it('treats closing as cancel', async () => {
    const a = confirmDialog('나갈까요?')
    const b = promptDialog('이름')
    settleDialog(dialogQueue.value[0]!, null)
    settleDialog(dialogQueue.value[0]!, null)
    expect(await a).toBe(false)
    expect(await b).toBeNull()
  })
})
