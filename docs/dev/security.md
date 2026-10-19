# 보안 규칙

> 상태: 초안 · v0.2 · 2026-10-19 — 원칙: **비용·사용량·AI 결과·멤버십은 서버만 쓴다.** 나머지 편집은 역할로 막는다.

## 1. 역할 판정
- `memberRole(ws)` = `get(/workspaces/{ws}/members/{uid}).data.role`
- `canView` = 멤버(모든 역할) 또는 운영자(`request.auth.token.admin == true`, #18)
- `canEdit` = owner · admin · editor
- `canManage` = owner · admin
- 운영자는 **읽기만** 열린다. 쓰기는 운영자 화면의 callable로만.

## 2. Firestore
| 경로 | 읽기 | 쓰기 |
| --- | --- | --- |
| `users/{uid}` | 본인, 운영자 | 본인: `displayName`, `photoURL`만. 나머지 서버 |
| `config/*` | 로그인한 사람 (`models`, `limits`). `access`는 운영자만 | 운영자만 |
| `adminViews/*` | 운영자 | 서버만 |
| `workspaces/{ws}` | `canView` | `canManage`: `name`, `defaults`만. `ownerId`·`monthlyLimitKrw`는 서버 |
| `…/members/*` | `canView` | 서버만 (4단계 초대도 callable) |
| `…/usage/*`, `…/aiJobs/*` | `canView` | 서버만 |
| `…/series/*`, `submissions/*`, `characters/*`, `styles/*` | `canView` | `canEdit`. `deletedAt`은 서버(`deleteToTrash`)만 |
| `…/episodes/{id}` | `canView` | `canEdit`. `costKrw`·`deletedAt`은 서버만 |
| `…/episodes/{id}/storyVersions/*`, `pages/*`, `panels/*`, `meta/*` | `canView` | `canEdit`. AI가 만든 각색안(`source == 'ai'`) 생성은 서버만 |
| `…/panels/{id}/candidates/*` | `canView` | 서버만. 예외: `canEdit`가 `hidden`·`favorite`만 수정 |
| `…/notifications/*` | `uid == 나` | 본인: `readAt`만 |
| `…/submissions/{id}/private/*` (3단계) | `canManage` | 서버만 |
| `intake/*` (3단계) | 누구나 (`enabled`, 안내 문구) | `canManage` (해당 워크스페이스) |
| `intakeTokens/*` (3-D 확인 링크) | 서버만 | 서버만 |
| `intakeBlocks/{slug}` (3-E 막은 제보 페이지) | 누구나 | 서버만 |
| `reports/*` (3-E 신고) | 운영자 | 서버만 |
| `workspaces/{ws}/config/intake` | `canView` | `canManage` (`slug`·`bannedWords`만) |
| `workspaces/{ws}/submissions/{id}/private/*` | `canManage` | 서버만 (`submitIntake`) |
| Storage `workspaces/{ws}/intake/**` | `canView` | 서버만 |

## 3. Storage
| 경로 | 읽기 | 쓰기 |
| --- | --- | --- |
| `workspaces/{ws}/images/**` | 멤버, 운영자 | 서버만 |
| `workspaces/{ws}/refs/**` | 멤버, 운영자 | `canEdit`, `image/*`, 10MB 이하 |
| `workspaces/{ws}/uploads/{uid}/**` | 본인 | 본인, `image/*`, 20MB 이하 |

- Storage 규칙에서 멤버 확인은 `firestore.get()`(교차 서비스 규칙)으로 한다.

## 4. 테스트
- `@firebase/rules-unit-testing` + 에뮬레이터: 역할 4개 × 경로별 읽기·쓰기, 다른 워크스페이스 접근 거절, 서버 전용 필드 쓰기 거절, 운영자 읽기 허용·쓰기 거절.
- Storage 규칙도 같은 방식으로 검사한다(`tests/rules/storage.test.ts`, Firestore·Storage 에뮬레이터를 같이 띄움): 참조 이미지·배경음악 형식, 보기 전용·외부인 거절, 제보 첨부·AI 결과는 멤버 읽기·클라이언트 쓰기 거절, 정의하지 않은 경로 거절.

## 변경 이력
- v0.1: 초안
- v0.2: 3-H — Storage 규칙 테스트 추가 (`pnpm test:rules`가 `firestore,storage` 에뮬레이터를 띄움)
