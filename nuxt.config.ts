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
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
      meta: [
        { name: 'theme-color', content: '#202538' },
        { name: 'description', content: '이야기를 넣으면, 웹툰이 완성된다. AI 웹툰 제작 스튜디오' },
        { property: 'og:title', content: 'TOONFLOW — Stories in. Comics out.' },
        { property: 'og:description', content: '이야기를 넣으면, 웹툰이 완성된다.' },
        { property: 'og:image', content: 'https://toonflow-studio.web.app/og-image.png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:type', content: 'website' },
      ],
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
