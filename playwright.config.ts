import { defineConfig, devices } from '@playwright/test'

// 1-L E2E: 에뮬레이터 + 가짜 모델 (pnpm e2e, 먼저 pnpm functions:build)
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 240_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  globalSetup: './tests/e2e/global-setup.ts',
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure', acceptDownloads: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    { command: 'pnpm exec firebase emulators:start --only auth,functions,firestore,tasks,storage --project demo-toonflow', url: 'http://127.0.0.1:4400/emulators', timeout: 180_000, stdout: 'pipe', reuseExistingServer: !process.env.CI },
    { command: 'pnpm dev --port 3000', url: 'http://localhost:3000', timeout: 240_000, reuseExistingServer: !process.env.CI, env: { NUXT_PUBLIC_FIREBASE_API_KEY: '', NUXT_PUBLIC_USE_EMULATOR: 'true' } },
  ],
})
