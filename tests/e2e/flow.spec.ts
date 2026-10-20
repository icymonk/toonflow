import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { unzipSync } from 'fflate'
import { E2E_EMAIL } from './global-setup'

/** 앱 안 확인 창(confirm)이 뜨면 바로 "확인"을 누른다 */
const acceptConfirms = (p: Page) => p.addLocatorHandler(p.getByRole('alertdialog'), d => d.getByRole('button', { name: '확인' }).click())

const AUTH = 'http://127.0.0.1:9099/emulator/v1/projects/demo-toonflow'
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64')
const STORY = '회사 엘리베이터에서 부장님 앞에서 방귀를 뀌었는데 부장님이 내 탓을 해 줬다. 알고 보니 부장님도 뀌었던 거였다.'

test('썰 등록 → 각색 → 콘티 → 그림 → 말풍선 → ZIP', async ({ page, browser }) => {
  await acceptConfirms(page)

  // 이메일 링크 로그인 (Auth 에뮬레이터의 oobCode)
  await page.goto('/login')
  await page.getByLabel('이메일').fill(E2E_EMAIL)
  await page.getByRole('button', { name: '로그인 링크 받기' }).click()
  await expect(page.getByText(`${E2E_EMAIL}로 로그인 링크를 보냈어요`)).toBeVisible()
  const { oobCodes } = await (await fetch(`${AUTH}/oobCodes`)).json() as { oobCodes: { email: string, oobCode: string }[] }
  const code = oobCodes.filter(c => c.email === E2E_EMAIL).at(-1)!.oobCode
  await page.goto(`/login/finish?mode=signIn&oobCode=${code}&apiKey=fake-api-key&lang=ko`)
  await expect(page.getByText('처음 사용 안내')).toBeVisible()

  // 캐릭터: 만들면 바로 편집 화면이 열리고, 고친 이름이 목록에 반영된다
  await page.goto('/characters')
  await page.getByRole('button', { name: '새 캐릭터' }).click()
  await expect(page.getByLabel('이름', { exact: true })).toHaveValue('새 캐릭터')
  await page.getByLabel('이름', { exact: true }).fill('E2E 주인공')
  await page.getByLabel('한 줄 소개').fill('엘리베이터의 신입')
  await expect(page.getByRole('button', { name: /E2E 주인공/ })).toBeVisible({ timeout: 10_000 })

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
  await page.getByRole('button', { name: '더 짧게' }).first().click()
  await expect(page.getByLabel(/^대사 \(한 줄에 하나/).first()).toHaveValue(/가짜 다시 쓰기/, { timeout: 60_000 })

  // 콘티
  await page.getByRole('tab', { name: /Storyboard/ }).click()
  await page.getByRole('button', { name: '자동 콘티' }).click()
  await expect(page.getByRole('button', { name: '다시 나누기' })).toBeVisible({ timeout: 90_000 })
  // 콘티 내보내기 (SBD-32): 대본 보기 → 글로 내려받기
  await page.getByRole('button', { name: '대본 보기', exact: true }).click()
  const [txt] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '글로 내려받기' }).click()])
  expect(txt.suggestedFilename()).toMatch(/_대본\.txt$/)
  expect(readFileSync((await txt.path())!, 'utf8')).toMatch(/# 1장\n## 1컷/)
  await page.getByRole('button', { name: '컷', exact: true }).click()

  // 그림
  await page.getByRole('tab', { name: /Illustrate/ }).click()
  await page.getByRole('button', { name: /빈 컷 모두 생성 \([1-9]\d*\)/ }).click()
  await expect(page.getByRole('button', { name: '빈 컷 모두 생성 (0)' })).toBeVisible({ timeout: 150_000 })

  // 내 그림 올리기 (ILL-30)
  await page.getByText('내 그림 올리기').locator('input[type=file]').setInputFiles({ name: 'mine.png', mimeType: 'image/png', buffer: PNG_1PX })
  await expect(page.getByText('후보로 올렸어요')).toBeVisible({ timeout: 30_000 })

  // 말풍선·검수 완료 (REV-20)
  await page.getByRole('tab', { name: /Review/ }).click()
  await page.getByRole('button', { name: '말풍선 자동 배치' }).click()
  await expect(page.locator('svg text').first()).toBeVisible()
  for (const item of ['오탈자', '개인정보', '출처·크레딧']) await page.getByLabel(item, { exact: true }).selectOption('pass')
  await expect(page.getByText('모두 통과')).toBeVisible()

  // AI 그림 품질 점검 (REV-13, 가짜 모델은 1번 그림을 지적)
  await page.getByRole('button', { name: /그림 품질 점검/ }).click()
  await expect(page.getByText(/가짜 점검: 손 모양이 어색해 보여요/)).toBeVisible({ timeout: 60_000 })

  // ZIP
  await page.getByRole('tab', { name: /Export/ }).click()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /ZIP으로 모두 내려받기/ }).click()])
  expect(dl.suggestedFilename()).toMatch(/\.zip$/)
  const files = Object.keys(unzipSync(readFileSync((await dl.path())!))).sort()
  expect(files.length).toBeGreaterThan(0)
  expect(files[0]).toMatch(/_1화_01\.jpg$/)

  // 릴스 영상 미리 보기·타임라인 (PUB-30~37)
  await page.getByRole('tab', { name: /릴스 영상/ }).click()
  const preview = page.getByLabel('영상 미리 보기')
  await expect(preview).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: /초/ }).first()).toBeVisible()
  await page.getByLabel('움직임', { exact: true }).selectOption('zoomIn')
  await expect(page.getByLabel('움직임', { exact: true })).toHaveValue('zoomIn')
  // 저장된 값이 다시 그려질 때까지 확인한다 (느린 CI에서 입력 직후 화면이 새로 그려지면 다시 입력)
  await expect(async () => {
    await page.getByLabel('보여 줄 시간(초)').fill('3')
    await page.getByLabel('보여 줄 시간(초)').blur()
    await expect(page.getByLabel('보여 줄 시간(초)')).toHaveValue('3', { timeout: 3_000 })
  }).toPass({ timeout: 45_000 })
  await expect.poll(() => preview.evaluate((cv: HTMLCanvasElement) => {
    const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data
    let n = 0
    for (let i = 0; i < d.length; i += 4 * 97) if (d[i]! < 200) n++
    return n
  })).toBeGreaterThan(50)
  // 표지·MP4 (PUB-38): 모든 컷 0.5초로 줄여 빨리 만든다
  await page.getByLabel('보여 줄 시간(초)').fill('0.5')
  await page.getByLabel('보여 줄 시간(초)').blur()
  await page.getByRole('button', { name: '모든 컷에 이 시간' }).click()
  await page.getByLabel('표지(첫 화면)').selectOption({ index: 1 })
  // 배경음악 (PUB-36): 1초 사인파 WAV
  const pcm = Buffer.alloc(48_000 * 2)
  for (let i = 0; i < 48_000; i++) pcm.writeInt16LE(Math.round(Math.sin(i / 48_000 * 2 * Math.PI * 440) * 8000), i * 2)
  const head = Buffer.alloc(44)
  head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVEfmt ', 8); head.writeUInt32LE(16, 16)
  head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22); head.writeUInt32LE(48_000, 24); head.writeUInt32LE(96_000, 28)
  head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(pcm.length, 40)
  await page.getByLabel('이 음원을 영상에 쓸 권리가 있어요').check()
  await page.getByLabel('음원 파일 올리기').setInputFiles({ name: 'bgm.wav', mimeType: 'audio/wav', buffer: Buffer.concat([head, pcm]) })
  await expect(page.getByRole('button', { name: '음악 빼기' })).toBeVisible()
  const [mp4] = await Promise.all([page.waitForEvent('download', { timeout: 120_000 }), page.getByRole('button', { name: 'MP4 내려받기' }).click()])
  expect(mp4.suggestedFilename()).toMatch(/_1화_릴스\.mp4$/)
  const bytes = readFileSync((await mp4.path())!)
  expect(bytes.subarray(4, 8).toString()).toBe('ftyp')
  expect(bytes.length).toBeGreaterThan(10_000)
  await expect(page.getByText(/MP4를 내려받았어요|Opus로 넣었어요/)).toBeVisible()
  await page.getByRole('tab', { name: '이미지' }).click()

  // 캡션·발행
  await page.getByRole('button', { name: /AI 캡션 초안/ }).click()
  await expect(page.getByPlaceholder(/캡션 본문/)).toHaveValue(/가짜 캡션/, { timeout: 60_000 })
  await page.getByPlaceholder(/게시 링크/).fill('https://www.instagram.com/p/e2e')
  await page.getByRole('button', { name: '게시함으로 표시' }).click()
  await expect(page.getByText(/게시함$/)).toBeVisible()
  await page.goto('/publish')
  await expect(page.getByRole('link', { name: 'https://www.instagram.com/p/e2e' })).toBeVisible()

  // 공개 제보 링크 (INB-02~05): 설정 → 로그인 없는 브라우저에서 제출 → Inbox
  await page.goto('/settings')
  await page.getByLabel('제보 받기').check()
  await page.getByLabel('작가 소개').fill('회사 썰 그리는 작가예요')
  await page.getByLabel(/질문 칸/).fill('언제 있었던 일이에요?')
  await page.getByRole('button', { name: '저장' }).last().click()
  const link = await page.getByTestId('intake-link').textContent()
  const guest = await (await browser.newContext()).newPage()
  await guest.goto(link!)
  await guest.getByLabel('이야기', { exact: true }).fill(`${STORY} 다음 날 부장님이 커피를 사 주셨다.`)
  await guest.getByLabel('언제 있었던 일이에요?').fill('지난주 금요일')
  await guest.getByLabel(/^닉네임/).fill('E2E독자')
  await guest.getByLabel('이메일 (선택, 게시되면 알려 드려요)').fill('reader@example.com')
  await guest.getByLabel(/크레딧으로/).check()
  await guest.getByLabel(/이메일로 알려/).check()
  await guest.getByLabel('동의 (필수)').check()
  await guest.getByRole('button', { name: '썰 보내기' }).click()
  await expect(guest.getByText('썰을 보냈어요. 고마워요!')).toBeVisible()
  await page.goto('/inbox')
  await page.locator('li', { hasText: '제보 링크 ·' }).first().click()
  await expect(page.getByText('[언제 있었던 일이에요?]').last()).toBeVisible()
  await expect(page.getByText('알림 받기 켜짐')).toBeVisible()
  await expect(page.getByText('reader@example.com')).toBeVisible()
  await expect(page.getByText('(E2E독자)')).toBeVisible()

  // INB-12: 확인 링크에서 동의 철회 → Inbox에 철회 표시
  await acceptConfirms(guest)
  await guest.goto((await guest.getByTestId('status-link').textContent())!)
  await expect(guest.getByText('작가가 읽어 보고 있어요.')).toBeVisible()
  await guest.getByRole('button', { name: '동의 철회' }).click()
  await expect(guest.getByText('동의를 철회했어요. 보낸 내용은 지웠어요.')).toBeVisible()

  // CMN-40: 공개 제보 페이지 신고
  await guest.goto(link!)
  await guest.getByText('이 페이지 신고').click()
  await guest.getByLabel('신고 이유').selectOption('spam')
  await guest.getByLabel('자세한 내용 (선택)').fill('광고 글이 올라와요')
  await guest.getByRole('button', { name: '신고하기' }).click()
  await expect(guest.getByText('신고했어요. 운영자가 확인해요.')).toBeVisible()
  await page.reload()
  await page.locator('li', { hasText: '제보 링크 ·' }).first().click()
  await expect(page.getByText(/제보자가 동의를 철회했어요/)).toBeVisible()
  // CMN-12: 동의 철회는 알림 종에도 뜨고, 누르면 그 제보로 간다
  await page.getByRole('button', { name: '알림' }).click()
  await page.getByRole('link', { name: /제보자가 동의를 철회했어요/ }).click()
  await expect(page).toHaveURL(/\/inbox\?id=/)

  // ACC-12: 새 워크스페이스를 만들면 그쪽이 열리고, 메뉴에서 원래 워크스페이스로 돌아온다
  await page.goto('/')
  const switcher = page.getByRole('button', { name: '워크스페이스 바꾸기' })
  await switcher.click()
  await page.getByRole('menuitem', { name: /새 워크스페이스/ }).click()
  const ask = page.getByRole('dialog')
  await ask.getByRole('textbox').fill('두 번째 작업실')
  await ask.getByRole('button', { name: '확인' }).click()
  await expect(switcher).toContainText('두 번째 작업실', { timeout: 30_000 })
  await switcher.click()
  await page.getByRole('menuitem').filter({ hasNotText: /두 번째 작업실|새 워크스페이스/ }).first().click()
  await expect(switcher).not.toContainText('두 번째 작업실', { timeout: 30_000 })
})
