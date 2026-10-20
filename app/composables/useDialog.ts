import { shallowRef } from 'vue'

interface ConfirmRequest { kind: 'confirm', message: string, resolve: (ok: boolean) => void }
interface PromptRequest { kind: 'prompt', message: string, value: string, resolve: (value: string | null) => void }
export type DialogRequest = ConfirmRequest | PromptRequest

/** 브라우저 기본 창 대신 앱 안 다이얼로그. 보여 주는 쪽은 components/app/DialogHost.vue */
export const dialogQueue = shallowRef<DialogRequest[]>([])

function push(req: DialogRequest) {
  dialogQueue.value = [...dialogQueue.value, req]
}

export function settleDialog(req: DialogRequest, result: boolean | string | null) {
  dialogQueue.value = dialogQueue.value.filter(r => r !== req)
  if (req.kind === 'confirm') req.resolve(result === true)
  else req.resolve(typeof result === 'string' ? result : null)
}

export function confirmDialog(message: string): Promise<boolean> {
  return new Promise(resolve => push({ kind: 'confirm', message, resolve }))
}

export function promptDialog(message: string, value = ''): Promise<string | null> {
  return new Promise(resolve => push({ kind: 'prompt', message, value, resolve }))
}
