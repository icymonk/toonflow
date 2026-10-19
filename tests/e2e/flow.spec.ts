import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { unzipSync } from 'fflate'
import { E2E_EMAIL } from './global-setup'

const AUTH = 'http://127.0.0.1:9099/emulator/v1/projects/demo-toonflow'
const STORY = '회사 엘리베이터에서 부장님 앞에서 방귀를 뀌었는데 부장님이 내 탓을 해 줬다. 알고 보니 부장님도 뀌었던 거였다.'

test('썰 등록 → 각색 → 콘티 → 그림 → 말풍선 → ZIP', async ({ page }) => {
  page.on('dialog', d => d.accept())

  // 이메일 링크 로그인 (Auth 에뮬레이터의 oobCode)
  await page.goto('/login')
  await page.getByLabel('이메일').fill(E2E_EMAIL)
  await page.getByRole('button', { name: '로그인 링크 받기' }).click()
  await expect(page.getByText(`${E2E_EMAIL}로 로그인 링크를 보냈어요`)).toBeVisible()
  const { oobCodes } = await (await fetch(`${AUTH}/oobCodes`)).json() as { oobCodes: { email: string, oobCode: string }[] }
  const code = oobCodes.filter(c => c.email === E2E_EMAIL).at(-1)!.oobCode
  await page.goto(`/login/finish?mode=signIn&oobCode=${code}&apiKey=fake-api-key&lang=ko`)
  await expect(page.getByText('처음 사용 안내')).toBeVisible()

  // 썰 등록
  await page.goto('/inbox')
  await page.getByRole('button', { name: '제보 등록' }).click()
  await page.getByLabel('본문').fill(STORY)
  await page.getByRole('button', { name: '등록', exact: true }).click()
  await expect(page.getByRole('tab', { name: '새 제보 1' })).toBeVisible()

  // 작품·에피소드
  await page.goto('/stories')
  await page.getByRole('button', { name: '새 작품' }).click()
  await page.getByLabel('작품 이름').fill('E2E 작품')
  await page.getByRole('button', { name: '만들기', exact: true }).click()
  await expect(page.getByRole('button', { name: /E2E 작품/ })).toBeVisible()
  await page.getByRole('button', { name: '새 에피소드' }).click()
  await page.getByLabel(/바로 입력/).fill(STORY)
  await page.getByRole('button', { name: '만들기', exact: true }).last().click()
  await page.waitForURL(/\/studio\?episode=/)

  // 각색
  await page.getByRole('button', { name: '각색안 만들기' }).click()
  await expect(page.getByText('사용 중').first()).toBeVisible({ timeout: 90_000 })

  // 콘티
  await page.getByRole('tab', { name: /Storyboard/ }).click()
  await page.getByRole('button', { name: '자동 콘티' }).click()
  await expect(page.getByRole('button', { name: '다시 나누기' })).toBeVisible({ timeout: 90_000 })

  // 그림
  await page.getByRole('tab', { name: /Illustrate/ }).click()
  await page.getByRole('button', { name: /빈 컷 모두 생성 \([1-9]\d*\)/ }).click()
  await expect(page.getByRole('button', { name: '빈 컷 모두 생성 (0)' })).toBeVisible({ timeout: 150_000 })

  // 말풍선
  await page.getByRole('tab', { name: /Review/ }).click()
  await page.getByRole('button', { name: '말풍선 자동 배치' }).click()
  await expect(page.locator('svg text').first()).toBeVisible()

  // ZIP
  await page.getByRole('tab', { name: /Export/ }).click()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /ZIP으로 모두 내려받기/ }).click()])
  expect(dl.suggestedFilename()).toMatch(/\.zip$/)
  const files = Object.keys(unzipSync(readFileSync((await dl.path())!))).sort()
  expect(files.length).toBeGreaterThan(0)
  expect(files[0]).toMatch(/_1화_01\.jpg$/)
})
