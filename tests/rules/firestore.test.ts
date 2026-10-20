import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'

const ROLES = ['owner', 'admin', 'editor', 'viewer'] as const
let env: RulesTestEnvironment
const db = (uid: string | null, admin = false) => (uid ? env.authenticatedContext(uid, admin ? { admin: true } : {}) : env.unauthenticatedContext()).firestore()
const W = 'workspaces/w1'

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-toonflow', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } })
  await env.withSecurityRulesDisabled(async (c) => {
    const f = c.firestore()
    await setDoc(doc(f, W), { name: 'w1', defaults: {} })
    for (const r of ROLES) await setDoc(doc(f, `${W}/members/${r}`), { role: r })
    await setDoc(doc(f, 'workspaces/w2'), { name: 'w2', defaults: {} })
    await setDoc(doc(f, 'workspaces/w2/members/other'), { role: 'owner' })
    await setDoc(doc(f, `${W}/submissions/s1`), { title: 't', body: 'b', note: '', sourceNote: '', tags: [], starred: false, status: 'new', source: 'dm', episodeIds: [] })
    await setDoc(doc(f, `${W}/aiJobs/j1`), { status: 'succeeded' })
    await setDoc(doc(f, `${W}/usage/2026-10`), { costKrw: 0 })
    await setDoc(doc(f, `${W}/episodes/e1`), { title: '1화', number: 1, step: 'story', status: 'active', settings: {}, deletedAt: null })
    await setDoc(doc(f, `${W}/episodes/e1/panels/p1`), { scene: 's', dialogues: [] })
    await setDoc(doc(f, `${W}/episodes/e1/panels/p1/candidates/c1`), { imagePath: 'x' })
    await setDoc(doc(f, `${W}/series/sr1`), { name: '작품', intro: '', episodeCount: 1, deletedAt: null })
    await setDoc(doc(f, `${W}/characters/ch1`), { name: '나', refImages: [], deletedAt: null })
    await setDoc(doc(f, `${W}/assets/a1`), { path: `${W}/refs/assets/a.png`, name: 'a.png', size: 1, tags: [], createdBy: 'editor' })
    await setDoc(doc(f, `users/editor`), { displayName: 'e', email: 'e@x' })
  })
})
afterAll(() => env?.cleanup())

describe('roles × paths', () => {
  it('members of every role read; outsiders and signed-out users do not', async () => {
    for (const r of ROLES) {
      await assertSucceeds(getDoc(doc(db(r), `${W}/submissions/s1`)))
      await assertSucceeds(getDoc(doc(db(r), `${W}/episodes/e1/panels/p1/candidates/c1`)))
    }
    await assertFails(getDoc(doc(db('other'), `${W}/submissions/s1`)))
    await assertFails(getDoc(doc(db(null), `${W}/episodes/e1`)))
  })
  it('owner/admin/editor edit, viewer does not', async () => {
    for (const r of ['owner', 'admin', 'editor']) await assertSucceeds(updateDoc(doc(db(r), `${W}/episodes/e1`), { title: `by ${r}` }))
    await assertFails(updateDoc(doc(db('viewer'), `${W}/episodes/e1`), { title: 'v' }))
    await assertSucceeds(updateDoc(doc(db('editor'), `${W}/episodes/e1`), { number: 3 }))
    await assertFails(updateDoc(doc(db('editor'), `${W}/episodes/e1`), { number: 0 }))
    await assertFails(updateDoc(doc(db('editor'), `${W}/episodes/e1`), { number: 1.5 }))
    await assertFails(updateDoc(doc(db('viewer'), `${W}/submissions/s1`), { starred: true }))
    await assertFails(updateDoc(doc(db('other'), `${W}/episodes/e1`), { title: 'x' }))
  })
  it('editors save masking and review states (2-A)', async () => {
    await assertSucceeds(updateDoc(doc(db('editor'), `${W}/submissions/s1`), { maskedBody: 'A씨가 ...' }))
    await assertSucceeds(updateDoc(doc(db('editor'), `${W}/episodes/e1`), { review: { typo: 'pass' } }))
    await assertFails(updateDoc(doc(db('viewer'), `${W}/episodes/e1`), { review: { typo: 'pass' } }))
    await assertSucceeds(updateDoc(doc(db('editor'), `${W}/episodes/e1`), { caption: { text: 'c', hashtags: [] }, published: { url: 'https://x' } }))
  })
  it('only owner/admin manage workspace settings', async () => {
    await assertSucceeds(updateDoc(doc(db('owner'), W), { name: 'new' }))
    await assertSucceeds(updateDoc(doc(db('admin'), W), { name: 'new2' }))
    await assertFails(updateDoc(doc(db('editor'), W), { name: 'x' }))
  })
})

describe('server-only fields', () => {
  it('rejects client writes to server data', async () => {
    const e = db('owner')
    await assertFails(setDoc(doc(e, `${W}/aiJobs/j2`), { status: 'queued' }))
    await assertFails(updateDoc(doc(e, `${W}/aiJobs/j1`), { status: 'failed' }))
    await assertFails(setDoc(doc(e, `${W}/usage/2026-10`), { costKrw: 0 }))
    await assertFails(setDoc(doc(e, `${W}/episodes/e1/panels/p1/candidates/c2`), { imagePath: 'y' }))
    await assertFails(updateDoc(doc(e, `${W}/episodes/e1/panels/p1/candidates/c1`), { imagePath: 'z' }))
    const up = { imagePath: `${W}/refs/panels/p1/a.png`, width: 1080, height: 1350, source: 'upload', jobId: '', input: null, hidden: false, favorite: false, workspaceId: W.split('/')[1], episodeId: 'e1', panelId: 'p1', createdAt: new Date() }
    await assertSucceeds(setDoc(doc(db('editor'), `${W}/episodes/e1/panels/p1/candidates/u1`), up))
    await assertFails(setDoc(doc(db('editor'), `${W}/episodes/e1/panels/p1/candidates/u2`), { ...up, source: 'ai' }))
    await assertFails(setDoc(doc(db('editor'), `${W}/episodes/e1/panels/p1/candidates/u3`), { ...up, imagePath: 'workspaces/w2/refs/panels/p1/a.png' }))
    await assertFails(addDoc(collection(e, `${W}/episodes`), { title: 'x', step: 'story', status: 'active' }))
    await assertFails(updateDoc(doc(e, `${W}/episodes/e1`), { deletedAt: new Date() }))
    await assertFails(updateDoc(doc(e, `${W}/submissions/s1`), { episodeIds: ['e1'] }))
    await assertFails(deleteDoc(doc(e, `${W}/episodes/e1`)))
    await assertFails(setDoc(doc(e, `${W}/members/editor`), { role: 'owner' }))
    await assertFails(updateDoc(doc(db('editor'), 'users/editor'), { email: 'z@x' }))
  })
  it('typeset accepts known fonts only', async () => {
    const ts = { font: 'jua', fontSize: 34, lineHeight: 1.3, strokeWidth: 3, strokeColor: '#1F2A44' }
    await assertSucceeds(setDoc(doc(db('editor'), `${W}/episodes/e1/meta/typeset`), ts))
    await assertFails(setDoc(doc(db('editor'), `${W}/episodes/e1/meta/typeset`), { ...ts, font: 'comic' }))
    await assertFails(setDoc(doc(db('viewer'), `${W}/episodes/e1/meta/typeset`), ts))
  })
  it('video settings validate shape (PUB-30~36)', async () => {
    const v = { aspect: '9:16', unit: 'panel', clips: { p1: { durationMs: 2000, motion: 'zoomIn' } }, musicPath: `${W}/refs/music/e1/a.mp3`, musicVolume: 0.8, musicFadeOutMs: 2000, musicLoop: true, coverId: null }
    const ref = `${W}/episodes/e1/meta/video`
    await assertSucceeds(setDoc(doc(db('editor'), ref), v))
    await assertFails(setDoc(doc(db('editor'), ref), { ...v, aspect: '16:9' }))
    await assertFails(setDoc(doc(db('editor'), ref), { ...v, musicPath: 'workspaces/other/refs/music/e1/a.mp3' }))
    await assertFails(setDoc(doc(db('editor'), ref), { ...v, musicVolume: 2 }))
    await assertFails(setDoc(doc(db('editor'), ref), { ...v, extra: 1 }))
    await assertFails(setDoc(doc(db('viewer'), ref), v))
  })
})

describe('2단계 경로', () => {
  it('series: editors archive and set notes; server-only counters are blocked', async () => {
    const ref = (u: string) => doc(db(u), `${W}/series/sr1`)
    await assertSucceeds(updateDoc(ref('editor'), { archivedAt: new Date(), memo: '세계관', reviewItems: ['로고'], hashtags: ['#툰'], greeting: '안녕', watermark: '@me' }))
    await assertFails(updateDoc(ref('viewer'), { archivedAt: null }))
    await assertFails(updateDoc(ref('editor'), { episodeCount: 9 }))
    await assertFails(updateDoc(ref('editor'), { deletedAt: new Date() }))
  })
  it('characters: variants up to 12, persona fields', async () => {
    const v = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: 'expression', label: `${i}`, path: `${W}/refs/characters/ch1/${i}.png` }))
    await assertSucceeds(updateDoc(doc(db('editor'), `${W}/characters/ch1`), { variants: v(12), personality: ['소심'], speech: ['어...'] }))
    await assertFails(updateDoc(doc(db('editor'), `${W}/characters/ch1`), { variants: v(13) }))
    await assertFails(updateDoc(doc(db('viewer'), `${W}/characters/ch1`), { personality: [] }))
  })
  it('assets: own uploads under refs/assets only; tags only on update', async () => {
    const a = { path: `${W}/refs/assets/b.png`, name: 'b.png', size: 2, tags: ['배경'], createdBy: 'editor', createdAt: new Date() }
    await assertSucceeds(setDoc(doc(db('editor'), `${W}/assets/a2`), a))
    await assertFails(setDoc(doc(db('editor'), `${W}/assets/a3`), { ...a, path: 'workspaces/w2/refs/assets/b.png' }))
    await assertFails(setDoc(doc(db('editor'), `${W}/assets/a4`), { ...a, createdBy: 'owner' }))
    await assertFails(setDoc(doc(db('viewer'), `${W}/assets/a5`), { ...a, createdBy: 'viewer' }))
    await assertSucceeds(updateDoc(doc(db('editor'), `${W}/assets/a1`), { tags: ['x'] }))
    await assertFails(updateDoc(doc(db('editor'), `${W}/assets/a1`), { path: `${W}/refs/assets/c.png` }))
  })
  it('candidates: editors import from aiJobs path and flag favorite/hidden only', async () => {
    const imp = { imagePath: `${W}/aiJobs/j1/0.png`, width: 1080, height: 1350, source: 'import', jobId: '', input: null, hidden: false, favorite: false, workspaceId: 'w1', episodeId: 'e1', panelId: 'p1', createdAt: new Date() }
    await assertSucceeds(setDoc(doc(db('editor'), `${W}/episodes/e1/panels/p1/candidates/i1`), imp))
    await assertFails(setDoc(doc(db('viewer'), `${W}/episodes/e1/panels/p1/candidates/i2`), imp))
    await assertSucceeds(updateDoc(doc(db('editor'), `${W}/episodes/e1/panels/p1/candidates/i1`), { favorite: true, hidden: false }))
    await assertFails(updateDoc(doc(db('editor'), `${W}/episodes/e1/panels/p1/candidates/i1`), { favorite: 'yes' }))
    await assertFails(updateDoc(doc(db('viewer'), `${W}/episodes/e1/panels/p1/candidates/i1`), { favorite: false }))
    await assertSucceeds(getDoc(doc(db('viewer'), `${W}/episodes/e1/panels/p1/candidates/i1`)))
    await assertFails(getDoc(doc(db('other'), `${W}/episodes/e1/panels/p1/candidates/i1`)))
  })
  it('submissions: AI summary and links are server-only', async () => {
    await assertFails(updateDoc(doc(db('owner'), `${W}/submissions/s1`), { aiSummary: { summary: ['x'], genre: 'comedy', score: 100, reason: '', jobId: 'j' } }))
    await assertFails(updateDoc(doc(db('owner'), `${W}/episodes/e1`), { duplicatedFrom: { id: 'e0' } }))
  })
})

describe('snapshots', () => {
  const snap = (uid: string) => ({ name: '1차 완성', createdBy: uid, createdAt: new Date(), title: '1화', pageOrder: [], activeStoryVersionId: null, pages: [], panels: [] })
  it('editors create their own snapshot and delete; viewers and updates are blocked', async () => {
    const ref = doc(db('editor'), `${W}/episodes/e1/snapshots/s1`)
    await assertSucceeds(setDoc(ref, snap('editor')))
    await assertFails(updateDoc(ref, { name: 'x' }))
    await assertFails(setDoc(doc(db('editor'), `${W}/episodes/e1/snapshots/s2`), snap('owner')))
    await assertFails(setDoc(doc(db('viewer'), `${W}/episodes/e1/snapshots/s3`), snap('viewer')))
    await assertFails(setDoc(doc(db('editor'), `${W}/episodes/e1/snapshots/s4`), { ...snap('editor'), extra: 1 }))
    await assertSucceeds(getDoc(doc(db('viewer'), `${W}/episodes/e1/snapshots/s1`)))
    await assertFails(deleteDoc(doc(db('viewer'), `${W}/episodes/e1/snapshots/s1`)))
    await assertSucceeds(deleteDoc(ref))
  })
})

describe('3단계 제보 링크 (INB-02~06·15)', () => {
  const page = { workspaceId: 'w1', enabled: true, name: '작가', intro: '', topics: '', questions: ['언제?'], images: false }
  it('owner/admin create and edit the public page; anyone reads it', async () => {
    await assertSucceeds(setDoc(doc(db('owner'), 'intake/abcd2345efgh'), page))
    await assertFails(setDoc(doc(db('editor'), 'intake/zzzz2345efgh'), page))
    await assertFails(setDoc(doc(db('other'), 'intake/abcd2345efgh'), { ...page, workspaceId: 'w2' }))
    await assertFails(setDoc(doc(db('owner'), 'intake/BAD'), page))
    await assertFails(setDoc(doc(db('owner'), 'intake/abcd2345efgh'), { ...page, extra: 1 }))
    await assertSucceeds(getDoc(doc(db(null), 'intake/abcd2345efgh')))
    await assertSucceeds(setDoc(doc(db('admin'), 'intake/abcd2345efgh'), { ...page, enabled: false }))
    await assertSucceeds(setDoc(doc(db('owner'), 'intake/abcd2345efgh'), { ...page, consentText: '동의해요' }))
    await assertFails(setDoc(doc(db('owner'), 'intake/abcd2345efgh'), { ...page, consentText: 'x'.repeat(501) }))
  })
  it('config: managers write slug and banned words; members read', async () => {
    await assertSucceeds(setDoc(doc(db('owner'), `${W}/config/intake`), { slug: 'abcd2345efgh', bannedWords: ['광고'] }))
    await assertFails(setDoc(doc(db('editor'), `${W}/config/intake`), { slug: 'abcd2345efgh', bannedWords: [] }))
    await assertFails(setDoc(doc(db('owner'), `${W}/config/other`), { slug: 'abcd2345efgh', bannedWords: [] }))
    await assertSucceeds(getDoc(doc(db('viewer'), `${W}/config/intake`)))
  })
  it('contact is readable by owner/admin only and written by the server only', async () => {
    await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), `${W}/submissions/s1/private/contact`), { nickname: 'n', email: 'e@x.co' }))
    await assertSucceeds(getDoc(doc(db('owner'), `${W}/submissions/s1/private/contact`)))
    await assertFails(getDoc(doc(db('editor'), `${W}/submissions/s1/private/contact`)))
    await assertFails(setDoc(doc(db('owner'), `${W}/submissions/s1/private/contact`), { nickname: 'x', email: '' }))
    await assertFails(getDoc(doc(db(null), 'intake/abcd2345efgh/rate/k')))
    await assertFails(getDoc(doc(db('owner'), 'intakeTokens/x')))
    await assertFails(setDoc(doc(db(null), 'intakeTokens/x'), { workspaceId: 'w1', submissionId: 's1' }))
  })
})

describe('3단계 신고 (CMN-40·53)', () => {
  it('blocks are public read, server write; reports are operator read only', async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), 'intakeBlocks/abcd2345efgh'), { workspaceId: 'w1' })
      await setDoc(doc(c.firestore(), 'reports/r1'), { kind: 'page', slug: 'abcd2345efgh', status: 'open' })
    })
    await assertSucceeds(getDoc(doc(db(null), 'intakeBlocks/abcd2345efgh')))
    await assertFails(deleteDoc(doc(db('owner'), 'intakeBlocks/abcd2345efgh')))
    await assertFails(setDoc(doc(db('ops', true), 'intakeBlocks/zzzz2345efgh'), { workspaceId: 'w1' }))
    await assertSucceeds(getDoc(doc(db('ops', true), 'reports/r1')))
    await assertFails(getDoc(doc(db('owner'), 'reports/r1')))
    await assertFails(addDoc(collection(db(null), 'reports'), { kind: 'page' }))
    await assertFails(updateDoc(doc(db('ops', true), 'reports/r1'), { status: 'resolved' }))
  })
})

describe('3단계 AI 점검·말풍선 템플릿 (ILL-43·REV-07·13)', () => {
  it('aiCheck is server-only; templates are editor create/delete with fixed fields', async () => {
    await assertFails(updateDoc(doc(db('editor'), `${W}/episodes/e1`), { aiCheck: { mode: 'quality', items: [], count: 1, jobId: 'j' } }))
    const tp = { name: '외침 크게', shape: 'shout', tail: 'b', fontSize: 40, bold: true, w: 300, h: 200, createdBy: 'editor', createdAt: new Date() }
    await assertSucceeds(setDoc(doc(db('editor'), `${W}/bubbleTemplates/t1`), tp))
    await assertFails(setDoc(doc(db('editor'), `${W}/bubbleTemplates/t2`), { ...tp, color: 'red' }))
    await assertFails(setDoc(doc(db('viewer'), `${W}/bubbleTemplates/t3`), { ...tp, createdBy: 'viewer' }))
    await assertSucceeds(getDoc(doc(db('viewer'), `${W}/bubbleTemplates/t1`)))
    await assertFails(updateDoc(doc(db('editor'), `${W}/bubbleTemplates/t1`), { name: 'x' }))
    await assertSucceeds(deleteDoc(doc(db('editor'), `${W}/bubbleTemplates/t1`)))
  })
})

describe('3단계 출력 보강·확인 링크 (PUB-07·23, ILL-24, INB-12)', () => {
  it('panels accept adjust only among new keys; episode settings carry hiRes/plannedAt; tokens and consents are server-only', async () => {
    await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), `${W}/episodes/e1/panels/p2`), { pageId: 'pg1', scene: 's', note: '', dialogues: [] }))
    const p2 = (uid: string) => doc(db(uid), `${W}/episodes/e1/panels/p2`)
    await assertSucceeds(updateDoc(p2('editor'), { adjust: { brightness: 110, contrast: 100, saturate: 90 } }))
    await assertFails(updateDoc(p2('editor'), { filter: 'blur(2px)' }))
    await assertFails(updateDoc(p2('viewer'), { adjust: null }))
    await assertSucceeds(updateDoc(doc(db('editor'), `${W}/episodes/e1`), { settings: { hiRes: true, plannedAt: '2026-11-01' } }))
    await assertFails(getDoc(doc(db('owner'), 'intakeTokens/abc')))
    await assertFails(setDoc(doc(db(null), 'intakeTokens/abc'), { workspaceId: 'w1', submissionId: 's1' }))
    await assertFails(setDoc(doc(db('owner'), `${W}/consents/c1`), { at: 1 }))
  })
})

describe('4단계 대기 명단 (CMN-41·52)', () => {
  it('waitlist is operator read only and server write', async () => {
    await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'waitlist/w1'), { email: 'a@x', name: 'a', status: 'pending' }))
    await assertSucceeds(getDoc(doc(db('ops', true), 'waitlist/w1')))
    await assertFails(getDoc(doc(db('owner'), 'waitlist/w1')))
    await assertFails(setDoc(doc(db(null), 'waitlist/w2'), { email: 'b@x', name: 'b', status: 'pending' }))
    await assertFails(updateDoc(doc(db('ops', true), 'waitlist/w1'), { status: 'approved' }))
    await assertFails(getDoc(doc(db(null), 'waitlistRate/r_x')))
  })
})

describe('4단계 멤버·초대 (ACC-20~22)', () => {
  it('members update only their own lastActiveAt; invites are visible to managers only', async () => {
    await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'invites/i1'), { workspaceId: 'w1', role: 'editor', expiresAt: new Date(), usedCount: 0 }))
    await assertSucceeds(updateDoc(doc(db('editor'), `${W}/members/editor`), { lastActiveAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(db('editor'), `${W}/members/editor`), { role: 'owner' }))
    await assertFails(updateDoc(doc(db('editor'), `${W}/members/viewer`), { lastActiveAt: serverTimestamp() }))
    await assertSucceeds(getDoc(doc(db('admin'), 'invites/i1')))
    await assertFails(getDoc(doc(db('editor'), 'invites/i1')))
    await assertFails(getDoc(doc(db('other'), 'invites/i1')))
    await assertFails(setDoc(doc(db('owner'), 'invites/i2'), { workspaceId: 'w1', role: 'admin' }))
  })
})

describe('4단계 활동·열람 기록 (CMN-31·54)', () => {
  it('activity is member-readable, admin views are manager/operator readable, both server-written', async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), `${W}/activity/a1`), { uid: 'owner', action: 'invite.create', at: new Date() })
      await setDoc(doc(c.firestore(), `${W}/adminViews/v1`), { by: 'ops', reason: 'x', at: new Date() })
    })
    await assertSucceeds(getDoc(doc(db('viewer'), `${W}/activity/a1`)))
    await assertFails(getDoc(doc(db('other'), `${W}/activity/a1`)))
    await assertFails(setDoc(doc(db('owner'), `${W}/activity/a2`), { uid: 'owner', action: 'x' }))
    await assertSucceeds(getDoc(doc(db('admin'), `${W}/adminViews/v1`)))
    await assertFails(getDoc(doc(db('editor'), `${W}/adminViews/v1`)))
    await assertSucceeds(getDoc(doc(db('ops', true), `${W}/adminViews/v1`)))
    await assertFails(setDoc(doc(db('ops', true), `${W}/adminViews/v2`), { by: 'ops', reason: 'y' }))
  })
})

describe('4단계 같이 보는 사람 (STU-24)', () => {
  it('members write only their own presence with server time', async () => {
    const P = `${W}/episodes/e1/presence`
    await assertSucceeds(setDoc(doc(db('viewer'), `${P}/viewer`), { name: 'v', photoURL: null, panelId: 'p1', at: serverTimestamp() }))
    await assertSucceeds(getDoc(doc(db('editor'), `${P}/viewer`)))
    await assertFails(setDoc(doc(db('editor'), `${P}/viewer`), { name: 'x', photoURL: null, panelId: null, at: serverTimestamp() }))
    await assertFails(setDoc(doc(db('editor'), `${P}/editor`), { name: 'x', photoURL: null, panelId: null, at: new Date(0) }))
    await assertFails(setDoc(doc(db('other'), `${P}/other`), { name: 'x', photoURL: null, panelId: null, at: serverTimestamp() }))
    await assertFails(getDoc(doc(db('other'), `${P}/viewer`)))
    await assertSucceeds(deleteDoc(doc(db('viewer'), `${P}/viewer`)))
  })
})

describe('4단계 워크스페이스·계정 (ACC-03·06·12~14)', () => {
  it('managers rename only; deletion, ownership and workspace lists are server-only', async () => {
    await assertSucceeds(updateDoc(doc(db('admin'), W), { name: '새 이름' }))
    await assertFails(updateDoc(doc(db('owner'), W), { deleteAt: new Date() }))
    await assertFails(updateDoc(doc(db('owner'), W), { plan: 'pro' }))
    await assertFails(updateDoc(doc(db('owner'), W), { ownerId: 'editor' }))
    await assertFails(updateDoc(doc(db('editor'), W), { name: 'x' }))
    await assertFails(setDoc(doc(db('editor'), 'workspaces/w3'), { name: 'w3', ownerId: 'editor', defaults: {} }))
    await assertFails(deleteDoc(doc(db('owner'), W)))
    await assertSucceeds(updateDoc(doc(db('editor'), 'users/editor'), { displayName: '편집자' }))
    await assertFails(updateDoc(doc(db('editor'), 'users/editor'), { workspaceIds: ['w2'] }))
    await assertFails(updateDoc(doc(db('editor'), 'users/editor'), { workspaceId: 'w2' }))
    await assertFails(updateDoc(doc(db('editor'), 'users/editor'), { deletedAt: null }))
    await assertFails(getDoc(doc(db('owner'), 'users/editor')))
    await assertFails(setDoc(doc(db('owner'), `${W}/members/newbie`), { role: 'editor' }))
  })
  it('the sign-up allow list is operator only', async () => {
    await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'config/access'), { allowedEmails: ['a@x'] }))
    await assertFails(getDoc(doc(db('owner'), 'config/access')))
    await assertFails(setDoc(doc(db('owner'), 'config/access'), { allowedEmails: ['me@x'] }))
    await assertSucceeds(getDoc(doc(db('ops', true), 'config/access')))
    await assertSucceeds(getDoc(doc(db('owner'), 'config/models')))
  })
})

describe('operator', () => {
  it('reads any workspace but cannot write', async () => {
    await assertSucceeds(getDoc(doc(db('op', true), `${W}/submissions/s1`)))
    await assertFails(updateDoc(doc(db('op', true), `${W}/episodes/e1`), { title: 'op' }))
    await assertFails(updateDoc(doc(db('op', true), W), { name: 'op' }))
  })
})
