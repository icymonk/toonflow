import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { addDoc, collection, deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
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
    await setDoc(doc(f, `${W}/episodes/e1`), { title: '1화', step: 'story', status: 'active', settings: {}, deletedAt: null })
    await setDoc(doc(f, `${W}/episodes/e1/panels/p1`), { scene: 's', dialogues: [] })
    await setDoc(doc(f, `${W}/episodes/e1/panels/p1/candidates/c1`), { imagePath: 'x' })
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
})

describe('operator', () => {
  it('reads any workspace but cannot write', async () => {
    await assertSucceeds(getDoc(doc(db('op', true), `${W}/submissions/s1`)))
    await assertFails(updateDoc(doc(db('op', true), `${W}/episodes/e1`), { title: 'op' }))
    await assertFails(updateDoc(doc(db('op', true), W), { name: 'op' }))
  })
})
