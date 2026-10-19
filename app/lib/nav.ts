import type { Component } from 'vue'
import { BookOpen, Clapperboard, House, Images, Inbox, Palette, Send, Settings, Users } from '@lucide/vue'

/** 메뉴: docs/planning/glossary.md 1절. 영어 메뉴 + 한국어 설명 */
export interface NavItem {
  to: string
  label: string
  ko: string
  icon: Component
}

export const NAV_MAIN: NavItem[] = [
  { to: '/', label: 'Home', ko: '홈', icon: House },
  { to: '/inbox', label: 'Inbox', ko: '제보함', icon: Inbox },
  { to: '/stories', label: 'Stories', ko: '작품', icon: BookOpen },
  { to: '/studio', label: 'Studio', ko: '제작실', icon: Clapperboard },
  { to: '/characters', label: 'Characters', ko: '캐릭터', icon: Users },
  { to: '/styles', label: 'Styles', ko: '그림체', icon: Palette },
  { to: '/assets', label: 'Assets', ko: '에셋', icon: Images },
  { to: '/publish', label: 'Publish', ko: '발행', icon: Send },
]

export const NAV_SETTINGS: NavItem = { to: '/settings', label: 'Settings', ko: '설정', icon: Settings }

/** 현재 경로가 메뉴에 속하는가 (Home은 정확히 / 일 때만) */
export function isActive(item: NavItem, path: string): boolean {
  return item.to === '/' ? path === '/' : path === item.to || path.startsWith(`${item.to}/`)
}
