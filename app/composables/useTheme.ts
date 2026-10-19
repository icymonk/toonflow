export type Theme = 'light' | 'dark' | 'system'
const KEY = 'toonflow:theme'

const theme = ref<Theme>('system')

function apply() {
  const dark = theme.value === 'dark' || (theme.value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function initTheme() {
  const saved = localStorage.getItem(KEY)
  theme.value = saved === 'light' || saved === 'dark' ? saved : 'system'
  apply()
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply)
}

export function useTheme() {
  const set = (t: Theme) => {
    theme.value = t
    if (t === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, t)
    apply()
  }
  return { theme: readonly(theme), set }
}
