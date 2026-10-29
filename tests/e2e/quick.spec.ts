import { expect, test } from '@playwright/test'
import { E2E_EMAIL } from './global-setup'

const AUTH = 'http://127.0.0.1:9099/emulator/v1/projects/demo-toonflow'

// QCK: 질문 카드 → AI 썰 → 만들기 → 끝까지 자동 → 완성 (모바일 폭)
test.use({ viewport: { width: 390, height: 844 } })
test('빠른 제작: 질문에 답하고 AI 썰로 끝까지 자동 제작', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(E2E_EMAIL)
  await page.getByRole('button', { name: '로그인 링크 받기' }).click()
  await expect(page.getByText(`${E2E_EMAIL}로 로그인 링크를 보냈어요`)).toBeVisible()
  const { oobCodes } = await (await fetch(`${AUTH}/oobCodes`)).json() as { oobCodes: { email: string, oobCode: string }[] }
  const code = oobCodes.filter(c => c.email === E2E_EMAIL).at(-1)!.oobCode
  await page.goto(`/login/finish?mode=signIn&oobCode=${code}&apiKey=fake-api-key&lang=ko`)
  await page.waitForURL(url => !url.pathname.startsWith('/login'))

  await page.goto('/quick')
  await page.getByRole('button', { name: /^한 장툰/ }).click()
  await expect(page.getByText('영상도 만들까요?')).toBeVisible()
  await page.getByRole('button', { name: /^영상도 만들기/ }).click()
  await page.getByRole('button', { name: '30초' }).click()
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await page.getByRole('button', { name: /^작품 기본/ }).click()
  await page.getByRole('button', { name: /^동물/ }).click()
  await page.getByRole('button', { name: /^반전·웃음/ }).click()
  await page.getByRole('button', { name: /짧게/ }).click()

  // QCK-18 AI 썰: 주제 추천 → 3개 → 고르기
  await page.getByRole('button', { name: 'AI가 만들기' }).click()
  await page.getByRole('button', { name: '#회사' }).click()
  await page.getByRole('button', { name: '가짜 설명 1' }).click()
  await page.getByRole('button', { name: /썰 3개 만들기/ }).click()
  await expect(page.getByText('가짜 썰 1')).toBeVisible()
  await expect(page.getByText('가짜 썰 3')).toBeVisible()
  await page.getByRole('button', { name: '고르기' }).first().click()
  await page.getByRole('button', { name: '다음', exact: true }).click()

  await expect(page.getByText('이대로 만들까요?')).toBeVisible()
  await page.getByRole('button', { name: '만들기', exact: true }).click()
  await expect(page.getByText('완성했어요')).toBeVisible({ timeout: 180_000 })

  // QCK-30 컷 다시 그리기·대사 고치기
  await page.getByRole('button', { name: '컷 1', exact: true }).click()
  await page.getByRole('button', { name: '다시 그리기' }).click()
  await expect(page.getByRole('button', { name: '다시 그리기' })).toBeEnabled({ timeout: 60_000 })
  await expect(page.getByRole('link', { name: /내려받기 · 영상 · 게시/ })).toBeVisible()
})
