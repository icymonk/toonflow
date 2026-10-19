import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { completeOnboardingInput, defaultWorkspaceName, isAllowedEmail } from '../../../shared/account'
import { ERROR_KEYS } from '../../../shared/callables'
import { authedCallable } from '../lib/callable'

/**
 * ACC-02·10: 허용 목록(config/access)에 있는 계정이면 users/{uid}, 내 워크스페이스, 소유자 멤버를 만든다.
 * 이미 있으면 그 워크스페이스를 돌려준다. 운영자(admin 클레임)는 목록과 관계없이 허용.
 */
export const completeOnboarding = authedCallable(completeOnboardingInput, async ({ uid, token }) => {
  const db = getFirestore()
  const userRef = db.doc(`users/${uid}`)
  const email = typeof token.email === 'string' ? token.email : null

  return db.runTransaction(async (tx) => {
    const user = await tx.get(userRef)
    const existing = user.get('workspaceId') as string | undefined
    if (existing) return { workspaceId: existing }

    const access = await tx.get(db.doc('config/access'))
    const allowed = (access.get('allowedEmails') as string[] | undefined) ?? []
    if (token.admin !== true && !(token.email_verified === true && isAllowedEmail(email, allowed))) {
      throw new HttpsError('permission-denied', ERROR_KEYS.notAllowed)
    }

    const displayName = typeof token.name === 'string' ? token.name : null
    const wsRef = db.collection('workspaces').doc()
    const now = FieldValue.serverTimestamp()
    tx.set(wsRef, { name: defaultWorkspaceName(displayName, email), ownerId: uid, defaults: {}, createdAt: now })
    tx.set(wsRef.collection('members').doc(uid), { role: 'owner', joinedAt: now })
    tx.set(userRef, {
      displayName: displayName ?? email?.split('@')[0] ?? '',
      email,
      photoURL: typeof token.picture === 'string' ? token.picture : null,
      workspaceId: wsRef.id,
      createdAt: now,
    })
    return { workspaceId: wsRef.id }
  })
})
