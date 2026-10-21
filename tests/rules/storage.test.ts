import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'
import { getBytes, ref, uploadBytes } from 'firebase/storage'
import { afterAll, beforeAll, describe, it } from 'vitest'

// docs/dev/security.md 3절 Storage: 멤버 확인은 Firestore members 문서를 본다
let env: RulesTestEnvironment
const st = (uid: string | null) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).storage()
const W = 'workspaces/w1'
const BYTES = new Uint8Array([1, 2, 3])
const put = (uid: string | null, path: string, contentType: string) => uploadBytes(ref(st(uid), path), BYTES, { contentType })

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-toonflow',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  })
  await env.withSecurityRulesDisabled(async (c) => {
    for (const r of ['owner', 'editor', 'viewer']) await setDoc(doc(c.firestore(), `${W}/members/${r}`), { role: r })
    await uploadBytes(ref(c.storage(), `${W}/intake/s1/a.png`), BYTES, { contentType: 'image/png' })
    await uploadBytes(ref(c.storage(), `${W}/aiJobs/j1/0.png`), BYTES, { contentType: 'image/png' })
  })
})
afterAll(() => env?.cleanup())

describe('storage', () => {
  it('reference images: editors upload images only; viewers and outsiders cannot', async () => {
    await assertSucceeds(put('editor', `${W}/refs/characters/ch1/a.png`, 'image/png'))
    await assertFails(put('editor', `${W}/refs/characters/ch1/a.txt`, 'text/plain'))
    await assertFails(put('viewer', `${W}/refs/characters/ch1/b.png`, 'image/png'))
    await assertFails(put('stranger', `${W}/refs/characters/ch1/c.png`, 'image/png'))
    await assertSucceeds(put('editor', `${W}/refs/pageDesigns/d1/a.png`, 'image/png'))
    await assertFails(put('editor', `${W}/refs/unknown/x/a.png`, 'image/png'))
  })
  it('background music (PUB-36): audio only under refs/music', async () => {
    await assertSucceeds(put('editor', `${W}/refs/music/e1/a.mp3`, 'audio/mpeg'))
    await assertFails(put('editor', `${W}/refs/music/e1/b.png`, 'image/png'))
    await assertFails(put('viewer', `${W}/refs/music/e1/c.mp3`, 'audio/mpeg'))
  })
  it('Instagram export pages (PUB-24): editors upload JPG only', async () => {
    await assertSucceeds(put('editor', `${W}/exports/e1/1/01.jpg`, 'image/jpeg'))
    await assertFails(put('editor', `${W}/exports/e1/1/02.png`, 'image/png'))
    await assertFails(put('viewer', `${W}/exports/e1/1/03.jpg`, 'image/jpeg'))
    await assertFails(put('stranger', `${W}/exports/e1/1/04.jpg`, 'image/jpeg'))
  })
  it('intake attachments and AI results: members read, clients never write', async () => {
    await assertSucceeds(getBytes(ref(st('viewer'), `${W}/intake/s1/a.png`)))
    await assertFails(getBytes(ref(st('stranger'), `${W}/intake/s1/a.png`)))
    await assertFails(getBytes(ref(st(null), `${W}/intake/s1/a.png`)))
    await assertFails(put(null, `${W}/intake/s2/a.png`, 'image/png'))
    await assertFails(put('owner', `${W}/intake/s2/a.png`, 'image/png'))
    await assertSucceeds(getBytes(ref(st('editor'), `${W}/aiJobs/j1/0.png`)))
    await assertFails(put('owner', `${W}/aiJobs/j2/0.png`, 'image/png'))
    await assertFails(put('owner', 'public/a.png', 'image/png'))
  })
})
