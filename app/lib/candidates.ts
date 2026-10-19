import type { Firestore } from 'firebase/firestore'
import { doc, getDoc } from 'firebase/firestore'
import { candidatePath } from '#shared/illustrate'

export interface CandidateRef { id: string, panelId: string }

const cache = new Map<string, Promise<string>>()

/** 후보 그림 경로. AI 후보는 id(`${jobId}_${i}`)에서, 올리거나 가져온 후보(ILL-30·31)는 후보 문서의 imagePath에서 */
export function resolveCandidatePath(db: Firestore, ws: string, episodeId: string, { id, panelId }: CandidateRef): Promise<string> {
  if (id.includes('_')) return Promise.resolve(candidatePath(ws, id))
  let p = cache.get(id)
  if (!p) {
    p = getDoc(doc(db, 'workspaces', ws, 'episodes', episodeId, 'panels', panelId, 'candidates', id)).then((snap) => {
      const path = snap.get('imagePath')
      if (typeof path !== 'string') throw new Error(`candidate ${id} has no image`)
      return path
    })
    p.catch(() => cache.delete(id))
    cache.set(id, p)
  }
  return p
}

/** 컷들에 고른 후보 */
export const selectedRefs = (cuts: { panel: { id: string, selectedCandidateId?: string | null } }[]): CandidateRef[] =>
  cuts.flatMap(c => (c.panel.selectedCandidateId ? [{ id: c.panel.selectedCandidateId, panelId: c.panel.id }] : []))
