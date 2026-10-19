import type { JobType } from '../../../shared/jobs'
import type { z } from 'zod'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { analysisSchema, draftSchema, parseJson, storyParams, titlesSchema } from '../../../shared/story'
import { AiError } from './errors'

interface JobDoc { type: JobType, target?: { episodeId?: string }, params?: Record<string, unknown> }

function parse<T>(schema: z.ZodType<T>, result: unknown): T {
  const out = typeof result === 'string' ? parseJson(schema, result) : null
  if (!out) throw new AiError('invalid_output', 'model output did not match schema')
  return out
}

/** ai-jobs.md 1절 8: 결과 반영. 문서 id를 jobId로 써서 다시 실행해도 한 번만 만든다 */
export async function applyResult(wsId: string, jobId: string, job: JobDoc, result: unknown) {
  const episodeId = job.target?.episodeId
  if (!episodeId || !job.type.startsWith('story.')) return
  const db = getFirestore()
  const epRef = db.doc(`workspaces/${wsId}/episodes/${episodeId}`)
  const params = storyParams.parse(job.params)
  const now = FieldValue.serverTimestamp()

  if (job.type === 'story.analyze') {
    const a = parse(analysisSchema, result)
    await epRef.update({ analysis: { ...a, jobId }, updatedAt: now })
  }
  else if (job.type === 'story.draft') {
    const d = parse(draftSchema, result)
    const ref = epRef.collection('storyVersions').doc(jobId)
    await db.runTransaction(async (tx) => {
      const [ep, existing] = await Promise.all([tx.get(epRef), tx.get(ref)])
      if (existing.exists || !ep.exists) return
      const n = ((ep.get('storyVersionCount') as number | undefined) ?? 0) + 1
      tx.set(ref, {
        label: `${n}안`,
        source: 'ai',
        logline: d.logline,
        scenes: d.scenes.map((s, i) => ({ id: `s${i + 1}`, ...s })),
        punchline: d.punchline,
        titleCandidates: d.titles,
        settings: { tone: params.tone, pageCount: params.pageCount, narrator: params.narrator, extraRequest: params.extraRequest },
        jobId,
        basedOn: params.basedOn ?? null,
        editedAt: null,
        createdAt: now,
      })
      // 첫 각색안은 바로 "사용 중"
      tx.update(epRef, { storyVersionCount: n, ...(ep.get('activeStoryVersionId') ? {} : { activeStoryVersionId: ref.id }), updatedAt: now })
    })
  }
  else if (job.type === 'story.titles' && params.versionId) {
    const t = parse(titlesSchema, result)
    await epRef.collection('storyVersions').doc(params.versionId).update({ titleCandidates: t.titles })
  }
}
