import { getApps, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { connectStorageEmulator, getStorage } from 'firebase/storage'
import { REGION } from '#shared/region'

export default defineNuxtPlugin(() => {
  const { firebase: config, useEmulator: emulatorFlag } = useRuntimeConfig().public
  // 설정 값이 없으면 데모 프로젝트로 에뮬레이터에 붙는다 (pnpm emulators)
  const demo = !config.apiKey
  const useEmulator = emulatorFlag || demo
  const projectId = demo ? 'demo-toonflow' : config.projectId
  const options = demo ? { apiKey: 'demo-key', projectId, appId: 'demo-app', storageBucket: `${projectId}.appspot.com` } : config
  const existing = getApps()[0]
  const app = existing ?? initializeApp(options)

  const auth = getAuth(app)
  const firestore = getFirestore(app)
  const storage = getStorage(app)
  // 배포된 앱은 Hosting rewrite(/fn/{name})로 같은 주소에서 호출한다 (docs/dev/architecture.md 7절)
  const sameOrigin = !useEmulator && !['localhost', '127.0.0.1'].includes(window.location.hostname)
  const functions = getFunctions(app, sameOrigin ? `${window.location.origin}/fn` : REGION)

  if (useEmulator && !existing) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
    connectStorageEmulator(storage, '127.0.0.1', 9199)
    connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  }

  return {
    provide: { firebaseApp: app, auth, firestore, storage, functions },
  }
})
