# 개발 문서

> 상태: 초안 · v0.1 · 2026-10-19 — 확정된 기획·기능명세(v1.0) 기준

기능명세가 "무엇을"이라면 이 폴더는 "어떻게"다. 기능명세와 충돌하면 **기능명세가 우선**이고, 이 문서를 고친다. 원본 기획 7~8절(Firebase 구성·컬렉션·AI 작업 흐름·디자인 토큰)과 [open-questions.md](../planning/open-questions.md) 3절 메모를 출발점으로 했다.

## 문서
| 문서 | 내용 | 상태 |
| --- | --- | --- |
| [architecture.md](./architecture.md) | 기술 스택, 저장소 구조, 클라이언트·서버 경계, 렌더링·출력, 배포 | 초안 |
| [data-model.md](./data-model.md) | Firestore 컬렉션·필드, Storage 경로 | 초안 |
| [ai-jobs.md](./ai-jobs.md) | AI 작업 처리: 대기열, 비용 예약·정산, 중복 과금 방지, 모델 교체 | 초안 |
| [functions.md](./functions.md) | 서버 기능(Cloud Functions) 목록 | 초안 |
| [security.md](./security.md) | Firestore·Storage 보안 규칙 | 초안 |
| [phase-plan.md](./phase-plan.md) | 먼저 할 기술 검증, 0~1단계 작업 분해, 사용자가 할 일 | 초안 |

## 개발 결정

### 확정 (기획 결정에서 옴)
| # | 항목 | 결정 | 근거 |
| --- | --- | --- | --- |
| D1 | 백엔드 | Firebase: Hosting, Authentication, Firestore, Storage, Functions 2nd gen, App Check. Blaze 요금제 필요 | 원본 7-1, open-questions 결정됨 |
| D2 | 앱 | Nuxt 5 nightly (`npm:nuxt-nightly@5x`) SPA (`ssr: false`) + shadcn-vue + Tailwind v4 + pnpm. memorize·boardlab과 같은 구성 | #1 |
| D3 | 브랜치 | `main`(운영) ← `develop`(기본) ← 기능 브랜치 | AGENTS |
| D4 | AI 비용 | 0~3단계는 운영자 API 키 + 워크스페이스 월 한도(기본 ₩50,000), 4단계에 크레딧 | #3, AIU-20 |
| D5 | 대사 글자 | 그림에 넣지 않고 앱이 얹는다 | #6 |
| D6 | 화면 언어 | 한국어만, 문구는 한곳에 모은다 | #15 |

### 추천안 (리뷰 필요)
| # | 항목 | 추천 | 이유 |
| --- | --- | --- | --- |
| R1 | 저장소 | **단일 앱 저장소** (memorize 방식: `app/` · `shared/` · `functions/`). 모노레포는 쓰지 않는다 | 앱이 하나다. boardlab은 게임 모듈 때문에 모노레포였다 |
| R2 | 데이터 위치 | 워크스페이스 데이터는 모두 `workspaces/{wsId}/…` 아래 | 규칙이 "멤버인가" 하나로 끝나고, 다른 워크스페이스 데이터가 섞일 수 없다 (open-questions 3절) |
| R3 | AI 작업 실행 | callable `startAiJob`이 권한·한도를 확인하고 작업 문서를 만든 뒤 **Functions 작업 대기열**(`onTaskDispatched`, Cloud Tasks)에 넣는다 | 동시 실행 수 제한(AIU-04)·재시도·긴 실행 시간을 기본 제공. Firestore 트리거 방식보다 제어가 쉽다 → [ai-jobs.md](./ai-jobs.md) |
| R4 | 모델 교체 | 서버의 `TextModel` / `ImageModel` 인터페이스 뒤에 제공사별 어댑터. 테스트·에뮬레이터용 `fake` 어댑터 | #4·#5 모델은 비교 후 정하고, 나중에 바꿀 수 있어야 한다 |
| R5 | 말풍선 렌더링·출력 | 장 하나를 그리는 **같은 Vue 컴포넌트(SVG)**로 화면 미리보기와 출력 이미지를 만든다. 출력은 브라우저에서 1080×1350으로 그려 JPG/PNG → ZIP | 화면과 결과가 같아야 한다(REV). 서버 렌더러가 필요한 직접 게시(PUB-24)는 5단계 |
| R6 | 리전 | Functions·Firestore·Storage 모두 서울 `asia-northeast3` | 사용자 대부분 국내 |
| R7 | 비밀 값 | AI 제공사 키는 Secret Manager(`defineSecret`). 앱에는 절대 두지 않는다 | open-questions 3절 |
| R8 | 가입 제한 | 0~3단계는 `config/access`의 허용 이메일 목록. `completeOnboarding`이 확인하고 워크스페이스를 만든다 | ACC-02 |
| R9 | 운영자 | Auth 커스텀 클레임 `admin == true`. 모든 워크스페이스 읽기 가능(#18), 운영자 화면은 열 때 `logAdminView`로 기록 | #18, CMN-54 |
| R10 | 금액 | 모든 금액은 **원 단위 정수**(`…Krw`). 제공사 비용(달러 등)은 작업 끝날 때 운영자 설정 환율로 바꿔 기록 | 표시(AIU-10)·한도(AIU-20) 계산 단순화 |
| R11 | 테스트 | Vitest(shared·functions·app), Firebase Emulator Suite(규칙·functions, `fake` 모델), Playwright(1단계 끝-끝 흐름) | boardlab과 같음 |

> Nuxt 5 nightly 주의 (memorize 경험): `typescript`는 `^6`으로 고정(TS 7은 JS API가 없어 Vue 도구가 깨짐). shadcn-vue CLI가 Nuxt 5를 인식하지 못하므로 루트 `tsconfig.json`의 `compilerOptions.paths`(`@/*`)로 `add`가 동작하게 한다.

## 리뷰 질문
- Firebase 프로젝트를 새로 만들어 주실 수 있나? (프로젝트 ID가 정해져야 0-2 진행)
- 이미 계정이 있는 AI 제공사가 있나? 기술 검증 S1·S2(모델 비교)에 먼저 넣는다

## 변경 이력
- v0.1: 초안 작성 (D1~D6 기획 결정, R1~R11 추천안)
