# 서버 기능 (Cloud Functions)

> 상태: 초안 · v0.1 · 2026-10-19

## 1. 공통 규칙
| 항목 | 내용 |
| --- | --- |
| 런타임 | Cloud Functions 2nd gen, Node 22, TypeScript, 서울(R6). esbuild로 `functions/src` + `shared/` 번들 → `functions/lib` (memorize 방식) |
| 호출 | callable(`onCall`), 로그인 필수, App Check. Hosting rewrite `/fn/{이름}` |
| 입력 검증 | `shared/schema`의 zod |
| 권한 | `functions/src/lib/authz.ts`: `requireMember(wsId, minRole)` — 클라이언트가 보낸 `wsId`를 믿지 않고 `members/{uid}`로 확인 (원본 7-2) |
| 오류 | `HttpsError` + 메시지 키(`error.limitExceeded` 등, 문구는 `app/locales/ko.ts`) |
| 비밀 값 | AI 제공사 키는 `defineSecret` (R7) |
| 이름 | callable은 동사(`startAiJob`), 작업 대기열은 `run…`, 예약은 `scheduled…`, 트리거는 `on{대상}{동작}` |

## 2. callable (0~1단계)
| 이름 | 하는 일 | 기능 | 단계 |
| --- | --- | --- | --- |
| `completeOnboarding` | `config/access` 허용 이메일 확인 → `users/{uid}`, 워크스페이스("○○의 스튜디오"), `members/{uid}`(owner) 생성. 이미 있으면 그대로 반환. 허용 안 되면 `permission-denied` → `/waiting` | ACC-02·10 | 0 |
| `startAiJob` | [ai-jobs.md](./ai-jobs.md) 1절 1~4 | AIU-01·10~12 | 1 |
| `cancelAiJob` | `queued`면 `canceled` + 예약 해제. `running`이면 취소 표시만(결과가 오면 버리지 않고 후보로 남김, 비용 정산) | AIU-03, ILL-06 | 1 |
| `retryAiJob` | 실패 작업을 같은 입력으로 새 작업으로 (`basedOn`), 받은 결과가 있으면 재사용 | AIU-03, ILL-41 | 1 |
| `setWorkspaceLimit` | 월 한도 바꾸기 (소유자·관리자) | AIU-20 | 0 |
| `deleteToTrash` / `restoreFromTrash` | 에피소드·제보·캐릭터·그림체에 `deletedAt` 넣기/빼기 (하위 문서는 그대로) | CMN-30, EPI-16 | 1 |
| `logAdminView` | 운영자 열람 기록 | CMN-54 | 4 |

- 컷·각색안 등 일반 편집은 callable 없이 클라이언트가 직접 쓴다 ([architecture.md](./architecture.md) 4절).

## 3. 작업 대기열 · 예약 · 트리거
| 이름 | 종류 | 하는 일 | 기능 |
| --- | --- | --- | --- |
| `runAiJob` | `onTaskDispatched` | AI 작업 실행 ([ai-jobs.md](./ai-jobs.md)). 제한 시간 9분(이미지 여러 장은 작업을 장마다 나눔) | AIU, ILL |
| `scheduledPurgeTrash` | 매일 04:00 KST | `deletedAt` 30일 지난 문서·파일 완전 삭제 | CMN-30 |
| `scheduledPruneJobs` | 매주 | 1년 지난 작업의 입력·원문 정리 | AIU-33 |
| `onCandidateCreated` | Firestore 트리거 | 첫 후보면 컷에 자동 선택, 결과 도착 알림 | ILL-11, STU-27, CMN-10 |

## 4. 작업 종류별 결과 반영
| `type` | 입력 | 결과 |
| --- | --- | --- |
| `story.analyze` | 재료 썰(가림 처리 본문) | 에피소드 `analysis` 갱신 (STO-10) |
| `story.draft` | 썰 + 설정(톤·장 수·화자·캐릭터) + 개수 n | `storyVersions` n개 (STO-11·12) |
| `story.titles` | 사용 중 각색안 | 각색안 `titleCandidates` (STO-14) |
| `story.suggest` | 각색안 + 칸 종류(`logline`·`heading`·`beats`·`punchline`) + 지금 내용 | 반영 없음. 앱이 `providerResult`의 후보 3개를 칩으로 보여 주고, 고르면 칸에 넣는다 (추천 입력) |
| `storyboard.split` | 사용 중 각색안 + 장 수 | `pages`·`panels` 생성. 이미 그림 있는 컷은 유지 여부를 앱이 먼저 묻고 `keepPanelIds`로 전달 (SBD-01·02) |
| `panel.image` | 컷 + 캐릭터 + 그림체 + 규격 | 후보 이미지 1장 (컷당 n장이면 작업 n개) (ILL-01·02·20) |
| `style.sample` | 그림체 + 기준 장면 3개 | 그림체 `samples` (STL-04) |

## 변경 이력
- v0.1: 초안
