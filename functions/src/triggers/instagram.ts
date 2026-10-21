import { logger } from 'firebase-functions'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getDownloadURL, getStorage } from 'firebase-admin/storage'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { ERROR_KEYS } from '../../../shared/callables'
import { publishImages } from '../lib/instagram'

/** PUB-24: publishInstagram이 접수한 게시를 처리한다. 끝나면 에피소드를 발행됨으로, 실패하면 instagramPost.status를 failed로.
 * 재시도하지 않는다(같은 글이 두 번 올라가지 않게) */
export const postInstagram = onDocumentCreated({ document: 'instagramPosts/{id}', timeoutSeconds: 300 }, async (event) => {
  const job = event.data
  if (!job) return
  const { workspaceId, episodeId, paths, caption } = job.data() as { workspaceId: string, episodeId: string, paths: string[], caption: string }
  const db = getFirestore()
  const epRef = db.doc(`workspaces/${workspaceId}/episodes/${episodeId}`)
  const bucket = getStorage().bucket()
  try {
    const tok = await db.doc(`instagramTokens/${workspaceId}`).get()
    if (!tok.exists || tok.get('expiresAt') < Date.now()) {
      await epRef.update({ instagramPost: { status: 'failed', error: ERROR_KEYS.instagramNotConnected, at: FieldValue.serverTimestamp() } })
      return
    }
    const urls = await Promise.all(paths.map(p => getDownloadURL(bucket.file(p))))
    const r = await publishImages(tok.get('accessToken'), tok.get('userId'), urls, caption)
    await epRef.update({
      status: 'published',
      published: { at: FieldValue.serverTimestamp(), url: r.permalink, instagramMediaId: r.mediaId },
      instagramPost: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }
  catch (e) {
    logger.warn('instagram post failed', { workspaceId, episodeId, e: String(e) })
    await epRef.update({ instagramPost: { status: 'failed', error: ERROR_KEYS.instagramFailed, at: FieldValue.serverTimestamp() } }).catch(() => {})
  }
  finally {
    await Promise.all(paths.map(p => bucket.file(p).delete().catch(() => {})))
    await job.ref.delete().catch(() => {})
  }
})
