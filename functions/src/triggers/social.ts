import type { SocialPlatform } from '../../../shared/social'
import type { Progress } from '../lib/instagram'
import { logger } from 'firebase-functions'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getDownloadURL, getStorage } from 'firebase-admin/storage'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { ERROR_KEYS } from '../../../shared/callables'
import * as ig from '../lib/instagram'
import * as th from '../lib/threads'

const PLATFORM = {
  instagram: { tokens: 'instagramTokens', post: 'instagramPost', publish: ig.publishImages, notConnected: ERROR_KEYS.instagramNotConnected, failed: ERROR_KEYS.instagramFailed },
  threads: { tokens: 'threadsTokens', post: 'threadsPost', publish: th.publishImages, notConnected: ERROR_KEYS.threadsNotConnected, failed: ERROR_KEYS.threadsFailed },
} as const

/** PUB-24·25: publishInstagram·publishThreads가 접수한 게시를 처리한다. 작업 문서에 진행을 남기고(AIU-01),
 * 끝나면 에피소드를 발행됨으로, 실패하면 에피소드 instagramPost·threadsPost.status를 failed로. 재시도하지 않는다(중복 게시 방지) */
export const postSocial = onDocumentCreated({ document: 'workspaces/{ws}/socialPosts/{id}', timeoutSeconds: 300 }, async (event) => {
  const job = event.data
  if (!job) return
  const ws = event.params.ws
  const { platform, episodeId, paths, caption } = job.data() as { platform: SocialPlatform, episodeId: string, paths: string[], caption: string }
  const p = PLATFORM[platform]
  if (!p) return
  const db = getFirestore()
  const epRef = db.doc(`workspaces/${ws}/episodes/${episodeId}`)
  const bucket = getStorage().bucket()
  const fail = async (error: string) => {
    await epRef.update({ [p.post]: { status: 'failed', error, at: FieldValue.serverTimestamp() } }).catch(() => {})
    await job.ref.update({ status: 'failed', error, progress: null, finishedAt: FieldValue.serverTimestamp() }).catch(() => {})
  }
  try {
    await job.ref.update({ status: 'running', startedAt: FieldValue.serverTimestamp(), progress: { step: 'prepare', done: 0, total: paths.length } })
    const tok = await db.doc(`${p.tokens}/${ws}`).get()
    if (!tok.exists || tok.get('expiresAt') < Date.now()) return await fail(p.notConnected)
    const urls = await Promise.all(paths.map(x => getDownloadURL(bucket.file(x))))
    const progress: Progress = (step, done, total) => job.ref.update({ progress: { step, done, total } }).catch(() => {})
    const r = await p.publish(tok.get('accessToken'), tok.get('userId'), urls, caption, undefined, undefined, progress)
    const now = FieldValue.serverTimestamp()
    // 발행 기록(published)은 먼저 올린 곳 기준. Threads는 따로 threadsPublished에도 남긴다
    const hasPublished = !!(await epRef.get()).get('published')
    await epRef.update({
      status: 'published',
      ...(platform === 'instagram'
        ? { published: { at: now, url: r.permalink, instagramMediaId: r.mediaId } }
        : { ...(hasPublished ? {} : { published: { at: now, url: r.permalink } }), threadsPublished: { at: now, url: r.permalink, mediaId: r.mediaId } }),
      [p.post]: FieldValue.delete(),
      updatedAt: now,
    })
    await job.ref.update({ status: 'succeeded', url: r.permalink, progress: { step: 'publish', done: 1, total: 1 }, finishedAt: now, paths: FieldValue.delete() })
  }
  catch (e) {
    logger.warn('social post failed', { ws, episodeId, platform, e: String(e) })
    await fail(p.failed)
  }
  finally {
    await Promise.all(paths.map(x => bucket.file(x).delete().catch(() => {})))
  }
})
