# AI 작업 처리

> 상태: 초안 · v0.2 · 2026-10-19 — 기능: [features/ai-usage.md](../features/ai-usage.md) AIU, 원본 7-3절

## 1. 흐름 (R3)
```
앱 ──startAiJob(type, target, params, idempotencyKey)──▶ callable
   1. 로그인 · 편집자 이상 · 입력 검증(zod)
   2. 예상 비용 계산 (shared/pricing.ts, config/models)
   3. 트랜잭션: idempotencyKey로 기존 작업 있으면 그 jobId 반환 (AIU-12)
               usage/{yyyymm}: spent + reserved + 예상 ≤ 한도 확인 → reserved += 예상
               aiJobs/{jobId} 생성 (status: queued)
   4. 작업 대기열에 { wsId, jobId } 넣기
앱 ◀── jobId ── (앱은 aiJobs 구독으로 대기열 패널·진행 표시, AIU-01)

runAiJob (onTaskDispatched, 대기열 설정으로 동시 실행·재시도 제어)
   5. 작업 읽기. canceled면 종료. status: running, attempts += 1
   6. 이미 받은 결과(providerResult)가 있으면 다시 호출하지 않고 7로 (재시도 무과금)
   7. 어댑터 호출 → 원본 결과를 먼저 작업 문서에 기록(텍스트) / Storage에 저장(이미지)
   8. 결과 반영: 각색안·콘티·후보 문서 만들기
   9. 트랜잭션: reserved -= 예상, spent += (실제 − 이미 청구한 costKrw), 에피소드 costKrw += 같은 값, status: succeeded
  실패: 오류 분류(3절). 재시도할 오류면 status: queued + error 기록 후 throw → 대기열이 다시 시도. 마지막 실패면 failed + 비용 정산

cancelAiJob: queued일 때만 canceled + 예약 해제. running·끝난 작업은 그대로 둔다
retryAiJob: failed일 때만. 예상 비용을 다시 예약 → attempts 0, retries += 1, queued → 대기열(taskId `{jobId}-r{retries}`)
```
- 대기열 이름은 `locations/asia-northeast3/functions/runAiJob`. 지역을 빼면 us-central1 대기열을 찾다가 404가 난다.
- 비용은 `costKrw`(지금까지 청구한 실제 비용)를 기준으로 차액만 더해서, 받아 둔 결과로 다시 시도해도 두 번 청구하지 않는다.
- `startAiJob`은 작업 종류에 맞는 켜진 모델이 없으면 `error.modelUnavailable`로 거절한다.
- 이미지 결과는 `workspaces/{ws}/aiJobs/{jobId}/{i}.png`(Storage)에 저장하고 `providerResult`에 경로 배열을 둔다. 멤버·운영자만 읽고 쓰기는 서버만 한다(storage.rules).
- 남은 일: 실행 중에 함수가 시간 초과로 죽으면 `running`으로 남는다. 오래된 running 작업을 failed로 정리하는 예약 함수를 1-B 이후에 붙인다.
- 브라우저를 닫아도 4 이후는 서버에서 계속된다 (AIU-02).
- 큰 요청 확인(AIU-11)은 앱이 `startAiJob` 전에 예상 비용으로 판단한다. 서버는 한도만 강제한다.

## 2. `workspaces/{ws}/aiJobs/{jobId}`
| 필드 | 내용 |
| --- | --- |
| `type` | `story.analyze` · `story.draft` · `story.titles` · `storyboard.split` · `panel.image` · `style.sample` (2단계: `story.rewrite`, `panel.inpaint`, `character.sheet` …) |
| `target` | `{ episodeId?, panelId?, styleId?, characterId? }` |
| `params` | 종류별 입력 (zod 스키마는 `shared/jobs.ts`) |
| `inputSnapshot` | 실제 보낸 프롬프트·참조 이미지 경로·모델 설정 (ILL-03, 같은 조건 재생성) |
| `model` | `config/models`의 id |
| `status` | `queued` · `running` · `succeeded` · `failed` · `canceled` (glossary 3절) |
| `estimateKrw`, `costKrw` | 예상·실제 (R10) |
| `providerRequestId`, `providerResult` | 제공사 요청 id, 받은 결과(텍스트 원문 또는 Storage 경로) — 재시도 무과금용 |
| `attempts`, `retries`, `error: { code, message, retryable }` | AIU-05. `attempts`는 이번 실행 회차, `retries`는 사용자가 다시 시도한 횟수 |
| `usage` | 제공사가 돌려준 사용량 `{ inTokens, outTokens }` 또는 `{ images }` (AIU-13 정산) |
| `idempotencyKey`, `requestedBy`, `createdAt`, `startedAt`, `finishedAt` | |

- 작업 기록 보존(AIU-33): 1년. 예약 함수가 오래된 `inputSnapshot`·`providerResult`만 지우고 비용 기록은 남긴다.
- `idempotencyKey`는 앱이 버튼 누를 때 만든 UUID. 두 번 눌러도 같은 키면 작업 하나.

## 3. 실패 분류 (AIU-05, ILL-40~42)
| 코드 | 뜻 | 재시도 | 화면 안내 |
| --- | --- | --- | --- |
| `limit_exceeded` | 월 한도 초과 (callable에서 거절) | — | 남은 한도·한도 바꾸기 |
| `policy_rejected` | 제공사 안전 정책 거절 | 안 함 | 장면 설명 바꾸기 (ILL-42) |
| `rate_limited` | 제공사 속도 제한 | 자동 (지수 백오프) | 대기 중 |
| `provider_error` | 제공사 5xx·시간 초과 | 자동 최대 3회 | 다시 시도 |
| `invalid_output` | 결과 형식 오류 (JSON 깨짐 등) | 자동 1회 | 다시 시도 |
| `internal` | 우리 쪽 오류 | 안 함 | 다시 시도 + 로그 |

- 실패해도 제공사 비용이 났으면 `costKrw`에 기록한다 (AIU-13).
- 최대 실행 횟수는 `shared/jobs.ts`의 `MAX_ATTEMPTS`. 분류는 `functions/src/ai/errors.ts`의 `classify`(429 → rate_limited, 5xx·시간 초과 → provider_error, 나머지 → internal).

### 에뮬레이터
- `firebase.json`의 `emulators.tasks`(9499)가 있어야 `runAiJob`이 돈다. `functions/src/global.ts`가 에뮬레이터에서 `CLOUD_TASKS_EMULATOR_HOST`, 서비스 계정, 기본 버킷을 채운다. 없으면 메타데이터 서버를 기다리다 60초 뒤 시간 초과가 난다.
- `config/models`에 `provider: "fake"` 모델을 넣으면 비용 없이 전체 흐름을 돌릴 수 있다.

## 4. 모델 어댑터 (R4)
```ts
interface TextModel {
  generate(req: { system: string; prompt: string; schema?: ZodType; maxTokens?: number }):
    Promise<{ text: string; json?: unknown; usage: { inTokens: number; outTokens: number }; requestId: string }>
}
interface ImageModel {
  generate(req: { prompt: string; negative?: string; refImages?: Buffer[]; size: { w: number; h: number }; n: number }):
    Promise<{ images: Buffer[]; requestId: string; billedImages: number }>
  inpaint?(req: { image: Buffer; mask: Buffer; prompt: string }): Promise<{ images: Buffer[]; requestId: string; billedImages: number }>
}
```
- `functions/src/ai/providers/{제공사}.ts`가 구현. `fake.ts`는 고정 텍스트·단색 이미지를 돌려줘 에뮬레이터·E2E에서 비용 없이 전체 흐름을 돌린다.
- 프롬프트는 `functions/src/ai/prompts/{type}.ts`. 컷 이미지 프롬프트 = 그림체(STL) + 등장 캐릭터 외형(CHR) + 장면·구도·표정(SBD-10) + "글자·말풍선 넣지 않기"(ILL-04).
- 글 AI 결과는 zod 스키마로 검증한 JSON(각색안 `scenes`, 콘티 `pages/panels`)으로 받는다.

## 5. 동시 실행 · 비용 표시
- 대기열 설정: 워크스페이스 구분 없이 전체 동시 실행 `maxConcurrentDispatches`(처음 5), 제공사 속도 제한에 맞춰 `maxDispatchesPerSecond`. 워크스페이스별 동시 실행 수(AIU-04)는 `startAiJob`이 `running+queued` 개수로 제한(기본 4).
- 예상 비용(AIU-10): 이미지 = 장수 × 모델 단가, 글 = 입력 길이로 추정한 토큰 × 단가 (높게 잡는다). 실제 비용은 제공사가 돌려준 사용량으로 정산.

## 변경 이력
- v0.1: 초안
- v0.2: 1-A 구현 반영 — 취소·다시 시도, 차액 정산, 이미지 저장 경로, 실패 분류 기준, 에뮬레이터 설정
