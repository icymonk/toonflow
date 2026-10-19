const PUBLIC_PATHS = new Set(['/login', '/login/finish', '/welcome'])

export default defineNuxtRouteMiddleware(async (to) => {
  // INB-02 공개 제보 링크: 로그인과 관계없이 연다
  if (to.path.startsWith('/s/')) return
  const auth = useAuthStore()
  await auth.init()

  if (!auth.user) {
    if (PUBLIC_PATHS.has(to.path)) return
    // CMN-41: 로그인 전 첫 화면은 랜딩
    return to.path === '/' ? navigateTo('/welcome') : navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
  if (PUBLIC_PATHS.has(to.path)) {
    return navigateTo(typeof to.query.redirect === 'string' ? to.query.redirect : '/')
  }

  await auth.loadAccount()
  // ACC-20: 초대 링크는 허용 목록에 없어도 연다
  if (auth.blocked && to.path !== '/waiting' && !to.path.startsWith('/join/')) return navigateTo('/waiting')
  if (!auth.blocked && to.path === '/waiting') return navigateTo('/')
})
