import type { User } from 'firebase/auth'
import type { Role } from '#shared/roles'
import type { WorkspaceDefaults, WorkspaceSettingsInput } from '#shared/workspace'
import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { defineStore } from 'pinia'
import { ERROR_KEYS } from '#shared/callables'
import { withDefaults } from '#shared/workspace'
import { callFn } from '~/lib/functions'

const EMAIL_KEY = 'toonflow:emailForSignIn'

export interface Profile {
  displayName: string
  email: string | null
  photoURL: string | null
  workspaceId: string
}

export interface Workspace {
  id: string
  name: string
  ownerId: string
  defaults: WorkspaceDefaults
}

export const useAuthStore = defineStore('auth', () => {
  const { $auth, $firestore, $functions } = useNuxtApp()

  const user = shallowRef<User | null>(null)
  const profile = ref<Profile | null>(null)
  const workspace = ref<Workspace | null>(null)
  const role = ref<Role | null>(null)
  /** ACC-02: 허용 목록에 없는 계정 */
  const blocked = ref(false)

  let readyPromise: Promise<void> | null = null
  let accountPromise: Promise<void> | null = null

  function reset() {
    profile.value = null
    workspace.value = null
    role.value = null
    blocked.value = false
    accountPromise = null
  }

  function init() {
    readyPromise ??= new Promise((resolve) => {
      onAuthStateChanged($auth, (u) => {
        user.value = u
        reset()
        resolve()
      })
    })
    return readyPromise
  }

  async function fetchAccount(uid: string) {
    let snap = await getDoc(doc($firestore, 'users', uid))
    if (!snap.exists()) {
      // ACC-10: 첫 로그인이면 서버가 허용 목록을 확인하고 내 워크스페이스를 만든다
      try {
        await callFn($functions, 'completeOnboarding', {})
      }
      catch (error) {
        if ((error as { message?: string }).message === ERROR_KEYS.notAllowed) {
          blocked.value = true
          return
        }
        throw error
      }
      snap = await getDoc(doc($firestore, 'users', uid))
    }
    profile.value = snap.data() as Profile
    const wsId = profile.value.workspaceId
    const [ws, member] = await Promise.all([
      getDoc(doc($firestore, 'workspaces', wsId)),
      getDoc(doc($firestore, 'workspaces', wsId, 'members', uid)),
    ])
    const data = ws.data() ?? {}
    workspace.value = { id: wsId, name: data.name, ownerId: data.ownerId, defaults: withDefaults(data.defaults) }
    role.value = (member.get('role') as Role | undefined) ?? null
  }

  /** 로그인한 사람의 프로필·워크스페이스를 읽는다. 없으면 만든다 */
  function loadAccount() {
    const uid = user.value?.uid
    if (!uid) return Promise.resolve()
    accountPromise ??= fetchAccount(uid).catch((error) => {
      accountPromise = null
      throw error
    })
    return accountPromise
  }

  function retryAccount() {
    reset()
    return loadAccount()
  }

  function signInWithGoogle() {
    return signInWithPopup($auth, new GoogleAuthProvider())
  }

  async function sendEmailLink(email: string, redirect?: string) {
    const url = new URL('/login/finish', window.location.origin)
    if (redirect) url.searchParams.set('redirect', redirect)
    await sendSignInLinkToEmail($auth, email, { url: url.toString(), handleCodeInApp: true })
    window.localStorage.setItem(EMAIL_KEY, email)
  }

  const isEmailLink = (href: string) => isSignInWithEmailLink($auth, href)
  const storedEmail = () => window.localStorage.getItem(EMAIL_KEY)

  async function finishEmailLink(email: string, href: string) {
    await signInWithEmailLink($auth, email, href)
    window.localStorage.removeItem(EMAIL_KEY)
  }

  /** ACC-05 */
  function signOut() {
    return firebaseSignOut($auth)
  }

  /** ACC-03 */
  async function saveDisplayName(displayName: string) {
    const uid = user.value?.uid
    if (!uid || !profile.value) return
    await updateDoc(doc($firestore, 'users', uid), { displayName })
    if ($auth.currentUser) await updateProfile($auth.currentUser, { displayName })
    profile.value = { ...profile.value, displayName }
  }

  /** ACC-11: 소유자·관리자만 (규칙이 다시 확인) */
  async function saveWorkspace(input: WorkspaceSettingsInput) {
    if (!workspace.value) return
    await updateDoc(doc($firestore, 'workspaces', workspace.value.id), { name: input.name, defaults: input.defaults })
    workspace.value = { ...workspace.value, ...input }
  }

  return {
    user,
    profile,
    workspace,
    role,
    blocked,
    init,
    loadAccount,
    retryAccount,
    signInWithGoogle,
    sendEmailLink,
    isEmailLink,
    storedEmail,
    finishEmailLink,
    signOut,
    saveDisplayName,
    saveWorkspace,
  }
})
