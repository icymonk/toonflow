// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,
  app: {
    head: {
      htmlAttrs: { lang: 'ko' },
      title: 'TOONFLOW',
    },
  },
  modules: ['shadcn-nuxt'],
  imports: {
    dirs: ['stores'],
  },
  css: ['~/assets/css/tailwind.css'],
  vite: {
    plugins: [
      tailwindcss(),
    ],
    // 내보내기·릴스 탭을 처음 열 때 개발 서버가 의존성을 다시 묶으며 페이지를 새로 고치지 않게 미리 묶는다 (CI E2E)
    optimizeDeps: { include: ['fflate', 'mediabunny'] },
  },
  shadcn: {
    prefix: '',
    componentDir: '@/components/ui',
  },
  runtimeConfig: {
    public: {
      firebase: {
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
      },
      useEmulator: false,
    },
  },
})
