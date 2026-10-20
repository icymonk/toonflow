# 아키텍처

> 상태: 초안 · v0.2 · 2026-10-19

## 1. 기술 스택
| 영역 | 선택 | 비고 |
| --- | --- | --- |
| 앱 | Nuxt 5 nightly SPA (`ssr: false`), Vue 3, TypeScript | D2. `nuxt generate` → Firebase Hosting |
| UI | shadcn-vue + Tailwind v4, 아이콘 lucide | 토큰은 [design/ui-system.md](../design/ui-system.md) 2-3절을 Tailwind 테마 변수로 |
| 글꼴 | 화면: Pretendard·Inter (자체 호스팅). 말풍선: 상업 이용 가능한 무료 글꼴 2~3개 (REV-04, 개발 전 라이선스 확인) | 출력 렌더링에 쓰므로 웹폰트 파일을 직접 둔다 |
| 문구 | `app/locales/ko.ts` 타입 있는 객체 | D6. 다른 언어는 같은 키로 추가 |
| 인증 | Firebase Auth: Google, 이메일+비밀번호(인증 메일), 이메일 링크 | ACC-01, #13 |
| DB | Cloud Firestore (서울) | R2 |
| 파일 | Cloud Storage (서울) | 원본·미리보기 이미지, 참조 이미지 |
| 서버 | Cloud Functions 2nd gen, Node 22, TypeScript, esbuild 번들 | callable + 작업 대기열(R3) + 예약 실행 |
| AI | 서버 어댑터 `TextModel`·`ImageModel` (R4) | 제공사는 S1·S2 뒤에 정함 |
| 검증·타입 | zod (`shared/`의 스키마를 앱·서버가 같이 씀) | |
| 출력 | 브라우저: SVG → Canvas → JPG/PNG, ZIP은 `fflate` | R5 |
| 테스트 | Vitest, Emulator Suite, Playwright | R11 |

## 2. 저장소 구조 (R1)
```
toonflow/
  app/                  Nuxt 앱
    pages/              라우트 (3절)
    components/
      ui/               shadcn-vue
      studio/           제작실 3영역, 단계별 패널
      page-render/      장 렌더러 (화면·출력 공용, R5)
    composables/        useWorkspace, useEpisode, useAiJobs …
    locales/ko.ts
    plugins/firebase.client.ts
  shared/               앱·서버 공용 순수 코드 (`#shared`)
    schema/             zod: 작업 입력, 문서 모양
    roles.ts            역할별 권한 판정 (users-and-roles 3절)
    pricing.ts          예상 비용 계산 (AIU-10)
    stale.ts            "영향 받음" 계산 (STU-12)
  functions/            Cloud Functions (pnpm 워크스페이스 패키지)
    src/callable/       영역별 callable
    src/ai/             어댑터·프롬프트·작업 처리 (ai-jobs.md)
    src/lib/            callable 공통 틀, 권한, 사용량
  firestore.rules · storage.rules · firebase.json
  docs/
```

## 3. 화면 · 라우트
| 경로 | 화면 | 기능 |
| --- | --- | --- |
| `/login`, `/onboarding`, `/waiting` | 로그인, 첫 설정, 승인 대기 | ACC-01·02·10 |
| `/` | Home | CMN-01~05 |
| `/inbox`, `/inbox/:id` | 제보함 | INB |
| `/stories`, `/stories/series/:id` | 작품·에피소드 목록 | EPI |
| `/studio/:episodeId/:step` | 제작실 (`step` = story·storyboard·illustrate·review·export) | STU, STO, SBD, ILL, REV, PUB |
| `/characters`, `/styles`, `/assets`, `/publish` | 메뉴별 목록 | CHR, STL, AST, PUB-20~ |
| `/settings/*` | 워크스페이스·사용량·AI·휴지통 | ACC-11, AIU-20~, CMN-30 |
| `/admin/*` | 운영자 | CMN-50~54 |

- 사이드바·위쪽 바는 [design/ui-system.md](../design/ui-system.md) 6절. 사이드바는 Ink Navy.
- 현재 워크스페이스는 1~3단계에 사람마다 하나(`users/{uid}.workspaceId`). 4단계에 전환(ACC-12)이 생기면 경로 앞에 `/w/:wsId`를 붙인다.

## 4. 클라이언트 · 서버 경계
| 일 | 누가 | 이유 |
| --- | --- | --- |
| 각색안·콘티·컷·말풍선 편집, 자동 저장 | 클라이언트가 Firestore에 직접 (규칙으로 편집자 이상만) | 서버 왕복 없이 즉시 저장(STU-20) |
| AI 호출, 비용 예약·정산, 작업 상태 | 서버만 | 비용·키 보호, 한도 우회 방지 |
| 후보 이미지 문서 만들기 | 서버만 (AI 결과, 올린 이미지 등록 모두) | 출처·비용 기록이 틀어지지 않게 |
| 사용량·한도 | 서버만 쓰기 | AIU-20 |
| 워크스페이스·멤버 만들기 | 서버 (`completeOnboarding`) | ACC-02 허용 목록 확인 |
| 출력 이미지·ZIP | 클라이언트 | R5. 저장하지 않고 바로 내려받기 (발행 기록은 2단계) |

## 5. 편집 모델
- **자동 저장**: 필드 단위로 0.8초 디바운스 후 `updateDoc`. 저장 상태(저장 중·저장됨·오프라인)를 위쪽 바에 표시. Firestore 오프라인 캐시 사용.
- **실행 취소**(STU-21): 클라이언트 메모리의 명령 기록(에피소드 단위, 최대 100개). 새로고침하면 사라진다. 지운 컷·장은 문서를 바로 지우지 않고 `deletedAt`을 넣어 되돌리기(STU-22)와 휴지통(CMN-30)을 같이 쓴다.
- **영향 받음**(STU-12): 앞 단계 문서가 바뀌면 `shared/stale.ts`가 뒤 단계에 `staleFrom`을 표시한다. 클라이언트가 편집과 같은 배치 쓰기로 넣는다. 결과는 지우지 않는다.
- **생성 중 편집**(STU-25): 작업 결과는 서버가 후보 문서로만 추가하고 컷의 다른 필드는 건드리지 않는다 → 편집과 충돌하지 않는다.

## 6. 렌더링 · 출력 (R5)
- `components/page-render/PageRender.vue`: 입력은 장 배치(SBD-23), 컷마다 선택된 이미지·자르기(ILL-23), 말풍선(REV-01~04). 출력은 고정 좌표계(1080×1350 등 PUB-01 규격)의 SVG.
- 화면에서는 SVG를 그대로 축소해 보이고, 출력 때는 같은 SVG를 오프스크린 Canvas에 그려 `toBlob('image/jpeg', 0.92)`. 글꼴은 `document.fonts.load`로 먼저 읽는다.
- 이미지는 Storage의 원본을 쓴다. Canvas 오염을 막으려면 Storage 버킷 CORS를 Hosting 도메인에 연다.
- 4:5 외 1:1·3:4는 같은 컴포넌트에 크기만 바꿔 넣는다. 자른 영역은 컷 `crop`에 비율로 저장한다.
- **영상(PUB-30~38, 3단계)**: 같은 렌더러로 컷 단위 SVG를 그리고, 시각마다 움직임·전환·말풍선 등장을 적용한 프레임을 Canvas에 그려 브라우저 WebCodecs(`VideoEncoder`, H.264 + 음원은 `AudioEncoder` AAC)로 인코딩, MP4로 묶는다(`mp4-muxer` 같은 작은 라이브러리). 30fps. WebCodecs를 못 쓰는 브라우저는 안내. 대안: 같은 프레임을 서버에서 ffmpeg로 (3단계 시작 때 검증).

## 7. 배포
- `.github/workflows/deploy.yml`: PR → Hosting 미리보기 채널, `main` 푸시 → 운영 배포(Hosting·Functions·규칙). memorize·boardlab과 같은 구조.
- GitHub에 `FIREBASE_SERVICE_ACCOUNT`, `NUXT_PUBLIC_FIREBASE_*` 등록. AI 키는 GitHub가 아니라 Secret Manager에만.
- callable은 Hosting rewrite `/fn/{이름}`로 같은 도메인에서 부른다 (boardlab 방식).

## 변경 이력
- v0.1: 초안
- v0.2: 영상 출력 렌더링 방식 추가
