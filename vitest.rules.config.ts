import { defineConfig } from 'vitest/config'

// docs/dev/security.md 4절: 에뮬레이터에서 보안 규칙 검사 (pnpm test:rules)
export default defineConfig({
  test: { include: ['tests/rules/**/*.test.ts'], environment: 'node', fileParallelism: false, testTimeout: 20_000 },
})
