import type { ModelsConfig } from '../../../shared/config'
import { getFirestore } from 'firebase-admin/firestore'
import { DEFAULT_MODELS } from '../../../shared/config'

/** config/models (운영자 설정). 문서가 없으면 빈 목록 */
export async function loadModels(): Promise<ModelsConfig> {
  return { ...DEFAULT_MODELS, ...(await getFirestore().doc('config/models').get()).data() } as ModelsConfig
}
