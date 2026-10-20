import { expect, test } from '@playwright/test'
import { E2E_PW_EMAIL } from './global-setup'

const AUTH = 'http://127.0.0.1:9099/emulator/v1/projects/demo-toonflow'
const PASSWORD = 'toonflow-e2e'

test('비밀번호 가입 → 메일 인증 → 다시 확인 → 로그아웃 → 비밀번호 로그인', async ({ page, browser }) => {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(E2E_PW_EMAIL)
  await page.getByLabel('비밀번호').fill(PASSWORD)
  await page.getByRole('button', { name: '처음이에요 · 비밀번호로 가입' }).click()
  await page.getByRole('button', { name: '가입하기' }).click()
  await expect(page.getByText('이메일 인증이 필요해요')).toBeVisible()

  const { oobCodes } = await (await fetch(`${AUTH}/oobCodes`)).json() as { oobCodes: { email: string, requestType: string, oobLink: string }[] }
  const link = oobCodes.filter(c => c.email === E2E_PW_EMAIL && c.requestType === 'VERIFY_EMAIL').at(-1)!.oobLink
  expect((await fetch(link)).ok).toBe(true)

  await page.getByRole('button', { name: '다시 확인' }).click()
  await expect(page.getByText('처음 사용 안내')).toBeVisible()

  // 로그인 기록이 없는 새 브라우저에서 비밀번호로 로그인
  const fresh = await (await browser.newContext({ baseURL: 'http://localhost:3000' })).newPage()
  await fresh.goto('/login')
  await fresh.getByLabel('이메일').fill(E2E_PW_EMAIL)
  await fresh.getByLabel('비밀번호').fill('wrong-password')
  await fresh.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(fresh.getByText('이메일 또는 비밀번호가 맞지 않아요')).toBeVisible()
  await fresh.getByLabel('비밀번호').fill(PASSWORD)
  await fresh.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(fresh.getByText('처음 사용 안내')).toBeVisible()
})
