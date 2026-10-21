import { logger } from 'firebase-functions'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getDownloadURL, getStorage } from 'firebase-admin/storage'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { ERROR_KEYS } from '../../../shared/callables'
import { publishImages } from '../lib/threads'

/** PUB-25: publishThreads가 접수한 게시를 처리한다. 끝나면 에피소드를 발행됨으로, 실패하면 threadsPost.status를 failed로.
 * 재시도하지 않는다(같은 글이 두 번 올라가지 않게) */
export const postThreads = onDocumentCreated({ document: 'threadsPosts/{id}', timeoutSeconds: 300 }, async (event) => {
  const job = event.data
  if (!job) return
  const { workspaceId, episodeId, paths, caption } = job.data() as { workspaceId: string, episodeId: string, paths: string[], caption: string }
  const db = getFirestore()
  const epRef = db.doc(`workspaces/${workspaceId}/episodes/${episodeId}`)
  const bucket = getStorage().bucket()
  try {
    const tok = await db.doc(`threadsTokens/${workspaceId}`).get()
    if (!tok.exists || tok.get('expiresAt') < Date.now()) {
      await epRef.update({ threadsPost: { status: 'failed', error: ERROR_KEYS.threadsNotConnected, at: FieldValue.serverTimestamp() } })
      return
    }
    const urls = await Promise.all(paths.map(p => getDownloadURL(bucket.file(p))))
    const r = await publishImages(tok.get('accessToken'), tok.get('userId'), urls, caption)
    const now = FieldValue.serverTimestamp()
    // 발행 기록(published)은 먼저 올린 곳 기준. Instagram으로 이미 발행됐으면 그대로 두고 Threads 링크만 남긴다
    const hasPublished = !!(await epRef.get()).get('published')
    await epRef.update({
      status: 'published',
      ...(hasPublished ? {} : { published: { at: now, url: r.permalink } }),
      threadsPublished: { at: now, url: r.permalink, mediaId: r.mediaId },
      threadsPost: FieldValue.delete(),
      updatedAt: now,
    })
  }
  catch (e) {
    logger.warn('threads post failed', { workspaceId, episodeId, e: String(e) })
    await epRef.update({ threadsPost: { status: 'failed', error: ERROR_KEYS.threadsFailed, at: FieldValue.serverTimestamp() } }).catch(() => {})
  }
  finally {
    await Promise.all(paths.map(p => bucket.file(p).delete().catch(() => {})))
    await job.ref.delete().catch(() => {})
  }
})
