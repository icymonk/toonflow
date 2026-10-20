// Hosting은 정적 폴더 주소에 끝 슬래시를 붙여 돌려보낸다(/login/finish → /login/finish/)
export const stripTrailingSlash = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') || '/' : path)

const AUTH_PATHS = new Set(['/login', '/login/finish'])

// 로그인 뒤 돌아갈 주소: 앱 안 경로만, 로그인 화면으로는 돌아가지 않는다
export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/'
  return AUTH_PATHS.has(stripTrailingSlash(value.split(/[?#]/)[0]!)) ? '/' : value
}
