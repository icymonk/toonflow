import type { Browser, Page } from '@playwright/test'
import { pick } from './pick'
import { expect, test } from '@playwright/test'

// 4-H: 대기 명단 → 운영자 승인 → 가입 (CMN-41·52), 초대 링크 → 참여 (ACC-20)
const P = 'demo-toonflow'
const AUTH = `http://127.0.0.1:9099/emulator/v1/projects/${P}`
const IDT = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1'
const OPS = 'e2e-ops@example.com'
const APPLICANT = 'e2e-wait@example.com'
const INVITEE = 'e2e-invitee@example.com'
const PW = 'toonflow-e2e'

const fresh = async (b: Browser) => (await b.newContext({ baseURL: 'http://localhost:3000' })).newPage()

/** 이메일 링크 로그인 (Auth 에뮬레이터의 oobCode). redirect를 주면 로그인 뒤 그 주소로 */
async function emailLink(page: Page, email: string) {
  await page.getByLabel('이메일').fill(email)
  await page.getByRole('button', { name: '로그인 링크 받기' }).click()
  await expect(page.getByText(`${email}로 로그인 링크를 보냈어요`)).toBeVisible()
  const { oobCodes } = await (await fetch(`${AUTH}/oobCodes`)).json() as { oobCodes: { email: string, oobCode: string, oobLink: string }[] }
  const link = new URL(oobCodes.filter(c => c.email === email).at(-1)!.oobLink)
  await page.goto(new URL(link.searchParams.get('continueUrl')!).pathname + new URL(link.searchParams.get('continueUrl')!).search
    + `&mode=signIn&oobCode=${link.searchParams.get('oobCode')}&apiKey=fake-api-key&lang=ko`)
}

/** 운영자 계정: 에뮬레이터에 미리 만들고 admin 권한·메일 인증을 붙인다 */
async function createOperator() {
  const res = await fetch(`${IDT}/accounts:signUp?key=fake-api-key`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: OPS, password: PW }) })
  const { localId } = await res.json() as { localId: string }
  await fetch(`${IDT}/projects/${P}/accounts:update`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Authorization': 'Bearer owner' },
    body: JSON.stringify({ localId, emailVerified: true, customAttributes: JSON.stringify({ admin: true }) }),
  })
}

test('대기 명단 신청 → 운영자 승인 → 가입, 초대 링크 → 참여', async ({ page, browser }) => {
  page.on('dialog', d => d.accept())
  await createOperator()

  // 신청 (로그인 전 랜딩)
  const applicant = await fresh(browser)
  await applicant.goto('/')
  await applicant.waitForURL(/\/welcome/)
  await applicant.getByLabel('이름 또는 작가명').fill('대기자')
  await applicant.getByLabel('이메일 (로그인에 쓸 주소)').fill(APPLICANT)
  await applicant.getByRole('checkbox').check()
  await applicant.getByRole('button', { name: '신청하기' }).click()
  await expect(applicant.getByText(/신청했어요/)).toBeVisible()

  // 승인 전에는 대기 화면
  await applicant.goto('/login')
  await emailLink(applicant, APPLICANT)
  await expect(applicant.getByText('승인 대기 중')).toBeVisible()

  // 운영자 승인
  await page.goto('/login')
  await page.getByLabel('이메일').fill(OPS)
  await page.getByLabel('비밀번호').fill(PW)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByText('처음 사용 안내')).toBeVisible()
  await page.goto('/admin')
  const row = page.locator('div', { hasText: APPLICANT }).filter({ has: page.getByRole('button', { name: '승인' }) }).last()
  await row.getByRole('button', { name: '승인' }).click()
  await expect(page.getByText(APPLICANT)).toBeHidden()

  // 승인 뒤 "다시 확인"으로 가입
  await applicant.getByRole('button', { name: '다시 확인' }).click()
  await expect(applicant.getByText('처음 사용 안내')).toBeVisible()

  // 운영자가 아니면 /admin은 403
  await applicant.goto('/admin')
  await expect(applicant.getByRole('alert').getByText('접근 권한이 없어요')).toBeVisible()

  // CMN-60~63 피드백: 사용자가 보내면 운영자가 /admin에서 답변하고, 사용자는 내 피드백에서 본다
  await applicant.getByRole('button', { name: '피드백 보내기' }).click()
  const fbDialog = applicant.getByRole('dialog', { name: '피드백 보내기' })
  await pick(fbDialog.getByLabel('종류'), 'question')
  await fbDialog.getByLabel('내용').fill('작품별 보기가 어디 있나요?')
  await fbDialog.getByRole('button', { name: '보내기', exact: true }).click()
  await expect(fbDialog).toBeHidden()
  await page.goto('/admin')
  await page.getByRole('button', { name: /작품별 보기가 어디 있나요/ }).click()
  await page.getByLabel('답변', { exact: true }).fill('화면 위 선택에서 골라요')
  await page.getByRole('button', { name: '답변 보내기' }).click()
  await expect(page.getByText('화면 위 선택에서 골라요')).toBeVisible()
  await applicant.goto('/feedback')
  await expect(applicant.getByText('답변함')).toBeVisible()
  await applicant.getByRole('button', { name: /작품별 보기가 어디 있나요/ }).click()
  await expect(applicant.getByText('화면 위 선택에서 골라요')).toBeVisible()

  // 초대 링크 (허용 목록에 없는 사람도 참여)
  await page.goto('/settings')
  await pick(page.getByLabel('초대할 역할'), 'editor')
  await page.getByRole('button', { name: '초대 링크 만들기' }).click()
  const link = await page.getByLabel('초대 링크').inputValue()
  const invitee = await fresh(browser)
  await invitee.goto(new URL(link).pathname)
  await invitee.waitForURL(/\/login/)
  await emailLink(invitee, INVITEE)
  await invitee.waitForURL(/\/join\//)
  await expect(invitee.getByText(/편집자 역할로 초대받았어요/)).toBeVisible()
  await invitee.getByRole('button', { name: '참여하기' }).click()
  await invitee.waitForURL(url => !url.pathname.startsWith('/join'))
  await expect(invitee.getByText('승인 대기 중')).toBeHidden()
  await page.reload()
  await expect(page.getByText(INVITEE, { exact: true })).toBeVisible()

  // AIU-24: 운영자가 요금제·크레딧을 직접 주면 설정의 한도에 반영된다
  await page.goto('/admin')
  await page.locator('tr', { hasText: 'e2e-ops의 스튜디오' }).getByRole('button', { name: '요금제' }).click()
  await pick(page.getByLabel('요금제 선택'), 'pro')
  await page.getByLabel('이번 달 추가 크레딧 (원)').fill('10000')
  await page.getByRole('button', { name: '지급' }).click()
  await expect(page.getByText(/프로 · 한도 ₩510,000/)).toBeVisible()
  await page.goto('/settings')
  await expect(page.getByText(/요금제 프로 · 월 한도 최대 ₩500,000 · 이번 달 추가 크레딧 ₩10,000/)).toBeVisible()
  await expect(page.getByText(/\/ ₩510,000/)).toBeVisible()
})
