import { readFileSync } from 'node:fs'
import { pick } from './pick'
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

  // CHR-04 미리보기: 눌러서 고르면 참조 이미지가 되고, 다시 누르면 빠지고, ×로 지운다
  await page.getByRole('button', { name: /후보 2개 만들기/ }).click()
  const picks = page.getByRole('button', { name: '이 미리보기 고르기' })
  await expect(picks).toHaveCount(2, { timeout: 30_000 })
  await picks.first().click()
  await expect(page.getByRole('button', { name: '고른 것 빼기' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '고른 것 빼기' }).click()
  await expect(picks).toHaveCount(2)
  await page.getByRole('button', { name: '미리보기 지우기' }).first().click()
  await expect(page.getByRole('button', { name: '미리보기 지우기' })).toHaveCount(1)

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

  // 추천 입력: 한 줄 요약 AI 추천 → 칩을 눌러 칸에 넣고, 넣은 뒤에도 고칠 수 있다
  await page.getByRole('button', { name: '한 줄 요약 AI 추천 3개 받기' }).click()
  await page.getByRole('button', { name: '가짜 추천 1' }).click({ timeout: 60_000 })
  await expect(page.locator('#sv-log')).toHaveValue('가짜 추천 1')
  // 스냅숏 이름은 단계·시각으로 미리 채우고, 칩으로 바꾼다
  await page.getByRole('button', { name: '스냅숏' }).click()
  const snapDialog = page.getByRole('dialog', { name: '스냅숏' })
  const snapName = snapDialog.getByLabel('스냅숏 이름', { exact: true })
  await expect(snapName).toHaveValue(/^각색 완료 · /)
  await snapDialog.getByRole('button', { name: '각색 확정 전' }).click()
  await expect(snapName).toHaveValue(/^각색 확정 전 · /)
  await snapDialog.getByRole('button', { name: '닫기' }).click()

  // STO-25: 각색 없이 원문 그대로인 안
  await page.getByRole('button', { name: '원문 그대로 쓰기' }).click()
  await expect(page.getByRole('button', { name: /원문 그대로.*사용 중/ })).toBeVisible({ timeout: 30_000 })

  // 이번 화 그림체를 각색 단계 오른쪽 패널에서 바로 고른다
  const epStyle = page.getByLabel('이번 화 그림체')
  await pick(epStyle, { index: 1 })
  await expect(epStyle).not.toHaveAttribute('data-value', '')

  // 에피소드 없이 제작실에 오면 마지막에 연 에피소드가 열리고, "다른 에피소드"는 목록을 보여 준다
  const epId = new URL(page.url()).searchParams.get('episode')
  const isEp = (u: URL) => u.pathname === '/studio' && u.searchParams.get('episode') === epId
  await page.goto('/studio')
  await page.waitForURL(isEp)
  await page.getByRole('link', { name: /다른 에피소드/ }).click()
  await expect(page.getByText('이어서 작업할 에피소드를 고르세요')).toBeVisible()
  await page.getByRole('listitem').getByRole('link').first().click()
  await page.waitForURL(isEp)

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

  // 좁은 화면: 장·컷 / 작업 / 속성 탭으로 하나씩 전체 폭
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('tab', { name: '작업' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: '속성' }).click()
  await expect(page.getByText(/^속성 · /)).toBeVisible()
  await expect(page.getByRole('button', { name: '자동 콘티' })).toBeHidden()
  await page.getByRole('tab', { name: '장·컷' }).click()
  await expect(page.getByText(/^속성 · /)).toBeHidden()
  await page.getByRole('tab', { name: '작업' }).click()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.getByRole('tab', { name: '작업' })).toBeHidden()

  // 그림
  await page.getByRole('tab', { name: /Illustrate/ }).click()
  await page.getByRole('button', { name: /빈 컷 모두 생성 \([1-9]\d*\)/ }).click()
  await expect(page.getByRole('button', { name: '빈 컷 모두 생성 (0)' })).toBeVisible({ timeout: 150_000 })

  // 내 그림 올리기 (ILL-30)
  await page.getByText('내 그림 올리기').locator('input[type=file]').setInputFiles({ name: 'mine.png', mimeType: 'image/png', buffer: PNG_1PX })
  await expect(page.getByText('후보로 올렸어요')).toBeVisible({ timeout: 30_000 })

  // 말풍선·검수 완료 (REV-20)
  await page.getByRole('tab', { name: /Review/ }).click()
  // 자동 배치 전에도 대사는 자동 자리에 그려지므로 "말풍선을 놓지 않은 대사"로 잡지 않는다
  await expect(page.locator('svg text').first()).toBeVisible()
  await expect(page.getByText(/말풍선을 놓지 않은 대사/)).toHaveCount(0)
  await page.getByRole('button', { name: '말풍선 자동 배치' }).click()
  await expect(page.locator('svg text').first()).toBeVisible()
  // 검수 단계 전체 미리보기에도 말풍선이 보인다 (STU-32)
  await page.getByRole('button', { name: '전체 미리보기' }).click()
  await expect(page.getByRole('dialog', { name: '전체 미리보기' }).locator('svg text').first()).toBeVisible()
  await page.keyboard.press('Escape')
  for (const item of ['오탈자', '개인정보', '출처·크레딧']) await pick(page.getByLabel(item, { exact: true }), 'pass')
  await expect(page.getByText('모두 통과')).toBeVisible()

  // AI 그림 품질 점검 (REV-13, 가짜 모델은 1번 그림을 지적)
  await page.getByRole('button', { name: /그림 품질 점검/ }).click()
  await expect(page.getByText(/가짜 점검: 손 모양이 어색해 보여요/).first()).toBeVisible({ timeout: 60_000 })

  // ZIP
  await page.getByRole('tab', { name: /Export/ }).click()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /ZIP으로 모두 내려받기/ }).click()])
  expect(dl.suggestedFilename()).toMatch(/\.zip$/)
  const files = Object.keys(unzipSync(readFileSync((await dl.path())!))).sort()
  expect(files.length).toBeGreaterThan(0)
  expect(files[0]).toMatch(/_1화_01\.jpg$/)
  // 표지 (PUB-15·17): 작품을 고른 채 표지를 만들면 그 작품 기본이 되고, 장 수에 함께 세어 첫 장으로 붙는다
  const studioUrl = page.url()
  await page.goto('/page-designs')
  await page.getByRole('button', { name: '새 표지' }).click()
  await expect(page.getByText('작품 1개 기본')).toBeVisible()
  await page.goto(studioUrl)
  await page.getByRole('tab', { name: /Export/ }).click()
  const withCover = page.getByRole('button', { name: `ZIP으로 모두 내려받기 (${files.length + 1}장)` })
  await expect(withCover).toBeVisible()
  const [dl2] = await Promise.all([page.waitForEvent('download'), withCover.click()])
  expect(Object.keys(unzipSync(readFileSync((await dl2.path())!)))).toHaveLength(files.length + 1)

  // 릴스 영상 미리 보기·타임라인 (PUB-30~37)
  await page.getByRole('tab', { name: /릴스 영상/ }).click()
  const preview = page.getByLabel('영상 미리 보기')
  await expect(preview).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: /초/ }).first()).toBeVisible()
  await pick(page.getByLabel('움직임', { exact: true }), 'zoomIn')
  await expect(page.getByLabel('움직임', { exact: true })).toHaveAttribute('data-value', 'zoomIn')
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
  await pick(page.getByLabel('표지(첫 화면)'), { index: 1 })
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
  await expect(page.getByRole('link', { name: '게시물', exact: true })).toHaveAttribute('href', 'https://www.instagram.com/p/e2e')
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
  await pick(guest.getByLabel('신고 이유'), 'spam')
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

  // CMN-04 빠른 시작: 썰만 넣으면 작품·에피소드를 만들고 각색이 바로 시작된다. EPI-05 그 작품이 지금 작품이 된다
  await page.goto('/')
  await page.getByLabel('썰로 바로 만들어 보기').fill(`빠른 시작 썰\n${STORY}`)
  await page.getByRole('button', { name: '바로 만들기' }).click()
  await page.waitForURL(/\/studio\?episode=/)
  await expect(page.getByText('사용 중').first()).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole('combobox', { name: '작업할 작품' })).toContainText('빠른 시작 썰')
  await page.goto('/characters')
  // 캐릭터 화면 위 작품 선택도 같은 값: 모든 작품으로 풀었다가 다시 고를 수 있다
  const scope = page.getByRole('combobox', { name: '작품별로 보기' })
  await expect(scope).toContainText('빠른 시작 썰')
  await pick(scope, '')
  await expect(scope).toContainText('모든 작품')
  await pick(scope, { index: 1 })
  await expect(page.getByRole('combobox', { name: '작업할 작품' })).not.toContainText('모든 작품')
  await pick(scope, '')
  await expect(page.getByRole('combobox', { name: '작업할 작품' })).toContainText('모든 작품')

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
