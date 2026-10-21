import { safeRedirect, stripTrailingSlash } from '~/lib/paths'

const PUBLIC_PATHS = new Set(['/login', '/login/finish', '/welcome'])
// CMN-42: 약관·방침은 로그인 여부와 관계없이 연다 (Meta 앱 심사도 이 주소를 연다)
const LEGAL_PATHS = new Set(['/terms', '/privacy', '/data-deletion'])

export default defineNuxtRouteMiddleware(async (to) => {
  const path = stripTrailingSlash(to.path)
  // INB-02 공개 제보 링크: 로그인과 관계없이 연다
  if (path.startsWith('/s/') || LEGAL_PATHS.has(path)) return
  const auth = useAuthStore()
  await auth.init()

  if (!auth.user) {
    if (PUBLIC_PATHS.has(path)) return
    // CMN-41: 로그인 전 첫 화면은 랜딩
    return path === '/' ? navigateTo('/welcome') : navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
  if (PUBLIC_PATHS.has(path)) return navigateTo(safeRedirect(to.query.redirect))

  await auth.loadAccount()
  // ACC-20: 초대 링크는 허용 목록에 없어도 연다
  if (auth.blocked && path !== '/waiting' && !path.startsWith('/join/')) return navigateTo('/waiting')
  if (!auth.blocked && path === '/waiting') return navigateTo('/')
})
