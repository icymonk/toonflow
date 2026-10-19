import type { Functions } from 'firebase/functions'
import type { Callables } from '#shared/callables'
import { httpsCallable } from 'firebase/functions'

type Input<K extends keyof Callables> = Callables[K] extends { input: infer I } ? I : never
type Output<K extends keyof Callables> = Callables[K] extends { output: infer O } ? O : never

/** 타입이 있는 callable 호출. 이름·입출력은 shared/callables.ts의 Callables */
export async function callFn<K extends keyof Callables>(
  functions: Functions,
  name: K,
  input: Input<K>,
): Promise<Output<K>> {
  const fn = httpsCallable<Input<K>, Output<K>>(functions, name)
  return (await fn(input)).data
}
