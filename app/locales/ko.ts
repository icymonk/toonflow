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
  errors: {
    signInAgain: '다시 로그인해 주세요.',
    invalidInput: '입력한 내용을 다시 확인해 주세요.',
    notAllowed: '아직 초대받지 않은 계정이에요. 승인되면 알려 드릴게요.',
    notMember: '이 워크스페이스의 멤버가 아니에요.',
    forbidden: '이 작업을 할 권한이 없어요.',
    limitExceeded: '이번 달 AI 사용 한도에 닿았어요. 한도를 늘리거나 다음 달에 다시 시도해 주세요.',
    popupBlocked: '팝업이 막혔어요. 브라우저에서 팝업을 허용해 주세요.',
    invalidEmail: '이메일 주소를 다시 확인해 주세요.',
    linkExpired: '로그인 링크가 만료됐어요. 새 링크를 받아 주세요.',
    network: '인터넷 연결을 확인하고 다시 시도해 주세요.',
    unknown: '문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.',
  },
} as const

export type Messages = typeof ko
