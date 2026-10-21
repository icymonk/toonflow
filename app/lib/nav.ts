import type { Component } from 'vue'
import { BookOpen, Clapperboard, House, Images, Inbox, LayoutTemplate, Palette, Send, Settings, Users } from '@lucide/vue'

/** 메뉴: docs/planning/glossary.md 1절. 영어 메뉴 + 한국어 설명 */
export interface NavItem {
  to: string
  label: string
  ko: string
  icon: Component
}

export interface NavGroup {
  /** 없으면 제목 없이 맨 위 */
  title?: string
  items: NavItem[]
}

/** 매일 쓰는 제작 흐름과, 만들어 두고 다시 쓰는 라이브러리를 나눈다. 그림체가 캐릭터보다 먼저(캐릭터 기준 그림을 그림체로 만든다) */
export const NAV_GROUPS: NavGroup[] = [
  { items: [{ to: '/', label: 'Home', ko: '홈', icon: House }] },
  {
    title: '제작',
    items: [
      { to: '/inbox', label: 'Inbox', ko: '제보함', icon: Inbox },
      { to: '/stories', label: 'Stories', ko: '작품', icon: BookOpen },
      { to: '/studio', label: 'Studio', ko: '제작실', icon: Clapperboard },
      { to: '/publish', label: 'Publish', ko: '발행', icon: Send },
    ],
  },
  {
    title: '라이브러리',
    items: [
      { to: '/styles', label: 'Styles', ko: '그림체', icon: Palette },
      { to: '/characters', label: 'Characters', ko: '캐릭터', icon: Users },
      { to: '/assets', label: 'Assets', ko: '에셋', icon: Images },
      { to: '/page-designs', label: 'Pages', ko: '표지·끝장', icon: LayoutTemplate },
    ],
  },
]

export const NAV_MAIN: NavItem[] = NAV_GROUPS.flatMap(g => g.items)

export const NAV_SETTINGS: NavItem = { to: '/settings', label: 'Settings', ko: '설정', icon: Settings }

/** 현재 경로가 메뉴에 속하는가 (Home은 정확히 / 일 때만) */
export function isActive(item: NavItem, path: string): boolean {
  return item.to === '/' ? path === '/' : path === item.to || path.startsWith(`${item.to}/`)
}
