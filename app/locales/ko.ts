// 화면 문구는 여기 한곳에 모은다 (#15). 용어는 docs/planning/glossary.md를 따른다.
export const ko = {
  brand: {
    name: 'TOONFLOW',
    slogan: 'Stories in. Comics out.',
    message: '이야기를 넣으면, 웹툰이 완성된다.',
  },
  home: {
    start: '새 에피소드 만들기',
  },
} as const

export type Messages = typeof ko
