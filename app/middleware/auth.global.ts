const PUBLIC_PATHS = new Set(['/login', '/login/finish'])

export default defineNuxtRouteMiddleware(async (to) => {
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
