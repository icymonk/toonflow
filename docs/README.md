# TOONFLOW 문서

AI 인스타툰 제작 SaaS **TOONFLOW**의 기획 문서 모음.

## 진행 방식

1. **기능명세 작성** — `planning/`, `features/`, `design/` 문서를 작성한다. 기능명세에는 개발 관점(데이터 구조, 기술 선택)을 넣지 않는다.
2. **리뷰** — 문서별로 읽고, 각 문서 맨 아래 **리뷰 질문**에 답하거나 기능 ID(예: `ILL-05`)를 지정해 수정 요청한다.
3. **확정** — 리뷰가 끝난 문서는 상태를 `확정`으로 바꾼다. 확정 후 변경은 문서 하단 변경 이력에 남긴다.
4. **개발 문서 작성** — 기능명세가 확정되면 `dev/` 문서(아키텍처, 데이터 모델, 보안, AI 작업 처리, 단계별 작업 계획)를 작성한다. 원본 기획 7~8절(Firebase 구성, 컬렉션 구조, AI 작업 흐름, 디자인 토큰)과 [open-questions.md](./planning/open-questions.md) 3절의 메모가 출발점이다.

> 현재: 기획·디자인·기능명세 **확정** v1.0 (2026-10-19). 다음은 개발 문서 `dev/`.

## 원본 기획
- [brief/toonflow-brief.md](./brief/toonflow-brief.md) — 사용자가 준 원본(브랜딩·UI·Firebase MVP 설계). **수정하지 않는다.** 아래 문서들이 원본을 기능 단위로 나누고 보강한 것이며, 원본과 다르게 정한 내용은 open-questions "2. 결정됨"에 기록한다.

## 문서 상태

| 문서 | 내용 | 상태 |
| --- | --- | --- |
| [planning/overview.md](./planning/overview.md) | 서비스 정의, 문제, 대상, 목표·비목표, 기능 지도, 핵심 개념, 핵심 흐름 | 확정 |
| [planning/users-and-roles.md](./planning/users-and-roles.md) | 사용자 유형, 워크스페이스 역할, 권한 표 | 확정 |
| [planning/glossary.md](./planning/glossary.md) | 메뉴명, 제작 단계명, 상태명 (제품 용어의 원본) | 확정 |
| [planning/roadmap.md](./planning/roadmap.md) | 출시 단계(첫 수직 기능 우선), 성공 지표 | 확정 |
| [planning/open-questions.md](./planning/open-questions.md) | 미결 · 결정 · 개발 단계 메모 | 계속 갱신 |
| [design/brand.md](./design/brand.md) | 브랜드 메시지, 로고, 보이스 & 톤 | 확정 |
| [design/ui-system.md](./design/ui-system.md) | 색상·대비, 토큰, 타이포, 컴포넌트, 레이아웃, 반응형, 접근성 | 확정 |
| [features/account.md](./features/account.md) | `ACC` 가입·로그인, 워크스페이스, 멤버 | 확정 |
| [features/inbox.md](./features/inbox.md) | `INB` 제보함 — 웹 제보, 직접 등록, 동의, 선별 | 확정 |
| [features/episodes.md](./features/episodes.md) | `EPI` Stories — 작품·에피소드 목록, 상태, 만들기 | 확정 |
| [features/studio.md](./features/studio.md) | `STU` 제작실 공통 — 레이아웃, 단계 이동, 자동 저장, 버전, 단축키 | 확정 |
| [features/story.md](./features/story.md) | `STO` Story — 썰 분석, AI 각색, 각색안 버전 | 확정 |
| [features/storyboard.md](./features/storyboard.md) | `SBD` Storyboard — 컷 분할, 장면·연출, 대사 확정 | 확정 |
| [features/illustrate.md](./features/illustrate.md) | `ILL` Illustrate — 컷 이미지 생성, 후보 비교·선택, 재생성·부분 수정 | 확정 |
| [features/review.md](./features/review.md) | `REV` Review — 말풍선·글자 배치, 품질·개인정보 검수 | 확정 |
| [features/publish.md](./features/publish.md) | `PUB` Export / Publish — 게시용 출력, 캡션, 발행 기록 | 확정 |
| [features/characters.md](./features/characters.md) | `CHR` 캐릭터 프로필, 참조 이미지, 일관성 | 확정 |
| [features/styles.md](./features/styles.md) | `STL` 그림체 프리셋 | 확정 |
| [features/assets.md](./features/assets.md) | `AST` 생성 이미지·참고 자료 보관함 | 확정 |
| [features/ai-usage.md](./features/ai-usage.md) | `AIU` AI 작업 대기열, 사용량·비용 한도, AI 설정 | 확정 |
| [features/common.md](./features/common.md) | `CMN` Home, 알림, 검색, 휴지통, 랜딩, 운영자 | 확정 |

상태: `초안` → `리뷰 중` → `확정`

### 추천 리뷰 순서
1. `planning/overview.md`, `planning/roadmap.md` — 무엇을 먼저 만드는지(첫 수직 기능)가 정해져야 나머지 범위가 흔들리지 않는다.
2. `planning/open-questions.md` — 범위를 크게 바꾸는 결정. 1차 결정 완료, 새 미결이 생기면 여기에 추가.
3. `features/story.md` → `storyboard.md` → `illustrate.md` → `review.md` → `publish.md` — 제작 흐름(핵심).
4. `features/characters.md`, `styles.md`, `ai-usage.md` — 그림 품질·비용을 좌우.
5. `features/inbox.md`, `episodes.md`, `studio.md`, `assets.md` — 제작 전후 관리.
6. `features/account.md`, `common.md`, `planning/users-and-roles.md`, `design/*` — 기반·주변.

## 기능명세 작성 규칙
- 모든 기능 문서는 같은 목차를 따른다:
  **목적 → 사용자 스토리 → 용어 → 기능 명세(ID) → 화면 구성 → 권한 → 예외 상황 → 출시 단계 → 리뷰 질문 → 변경 이력**
- 기능마다 **ID**를 붙인다. 리뷰·수정 요청 시 ID로 가리킨다.

| 접두어 | 문서 | 접두어 | 문서 |
| --- | --- | --- | --- |
| `ACC` | account | `REV` | review |
| `INB` | inbox | `PUB` | publish |
| `EPI` | episodes | `CHR` | characters |
| `STU` | studio | `STL` | styles |
| `STO` | story | `AST` | assets |
| `SBD` | storyboard | `AIU` | ai-usage |
| `ILL` | illustrate | `CMN` | common |

- 번호는 문서 안에서 묶음별로 띄워 매긴다(01~, 10~, 20~ …). 새 기능은 묶음 끝 번호를 이어 쓰고, 지운 번호는 재사용하지 않는다.
- 사용자 관점으로 쓴다. 저장 방식, 기술 이름, 필드명은 쓰지 않는다.
- 문서 간 겹치는 내용은 한 곳에만 쓰고 나머지는 링크한다.
- 각 기능의 **출시 단계**는 [roadmap.md](./planning/roadmap.md)의 단계 번호(0~5)를 쓴다.
