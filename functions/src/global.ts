import { initializeApp } from 'firebase-admin/app'
import { setGlobalOptions } from 'firebase-functions/v2'
import { REGION } from '../../shared/region'

// ESM은 import를 먼저 평가하므로, 함수 정의(onCall 등)보다 먼저 import되는 이 모듈에서 전역 설정을 한다.
const emulator = process.env.FUNCTIONS_EMULATOR === 'true'
if (emulator) {
  // 작업 대기열을 Cloud Tasks 에뮬레이터(firebase.json 9499)로. 서비스 계정을 주지 않으면 메타데이터 서버를 기다리다 멈춘다
  process.env.CLOUD_TASKS_EMULATOR_HOST ??= '127.0.0.1:9499'
}
initializeApp(emulator ? { serviceAccountId: 'emulated-service-acct@email.com' } : undefined)
setGlobalOptions({ region: REGION, maxInstances: 10 })
