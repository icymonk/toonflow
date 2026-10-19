const PUBLIC_PATHS = new Set(['/login', '/login/finish'])

export default defineNuxtRouteMiddleware(async (to) => {
  // INB-02 공개 제보 링크: 로그인과 관계없이 연다
  if (to.path.startsWith('/s/')) return
  const auth = useAuthStore()
  await auth.init()

  if (!auth.user) {
    return PUBLIC_PATHS.has(to.path) ? undefined : navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
  if (PUBLIC_PATHS.has(to.path)) {
    return navigateTo(typeof to.query.redirect === 'string' ? to.query.redirect : '/')
  }

  await auth.loadAccount()
  if (auth.blocked && to.path !== '/waiting') return navigateTo('/waiting')
  if (!auth.blocked && to.path === '/waiting') return navigateTo('/')
})
