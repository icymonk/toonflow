# 데이터 구조

> 상태: 초안 · v0.9 · 2026-10-19 — 원칙: 워크스페이스 데이터는 모두 `workspaces/{wsId}` 아래(R2). 금액은 원 단위 정수(R10). 시각은 `Timestamp`.

## 1. Firestore

### 최상위
| 경로 | 내용 | 기능 |
| --- | --- | --- |
| `users/{uid}` | `displayName`, `email`, `photoURL`, `workspaceId`(1~3단계 내 워크스페이스), `ageConfirmedAt`(4단계), `createdAt` | ACC-01·03·10 |
| `config/access` | `allowedEmails: string[]` (0~3단계 가입 허용 목록) | ACC-02 |
| `config/models` | 모델 목록: `{ id, kind: 'text'\|'image', provider, label, priceKrw: { perCall?, perImage?, perKTokensIn?, perKTokensOut? }, enabled }[]`, `defaults: { text, image }`, `usdToKrw` | AIU-30, CMN-50 |
| `config/limits` | 워크스페이스 기본 월 한도(`monthlyLimitKrw: 50000`), 1회 확인 기준(`confirmOverKrw: 3000`), 동시 실행 수 | AIU-04·11·20 |
| `adminViews/{id}` | 운영자 열람 기록: `adminUid`, `workspaceId`, `path`, `at` | CMN-54 (4단계) |

### `workspaces/{wsId}`
| 필드 | 내용 |
| --- | --- |
| `name` | "○○의 스튜디오" (ACC-10) |
| `ownerId` | 소유자 uid |
| `monthlyLimitKrw` | 월 한도 (AIU-20). 없으면 `config/limits` 기본 |
| `defaults` | `{ aspect: '4:5', pageCount: 6, storyDraftCount: 1, candidateCount: 2, narrator: 'first', textModel?, imageModel? }` (AIU-31, EPI-01 기본값의 맨 위 단계) |
| `createdAt` | |

### 워크스페이스 하위
| 경로 | 주요 필드 | 기능 |
| --- | --- | --- |
| `members/{uid}` | `role: 'owner'\|'admin'\|'editor'\|'viewer'`, `joinedAt` | users-and-roles 2절 |
| `usage/{yyyymm}` | `reservedKrw`, `spentKrw`, `jobCount`, `byType: { [type]: spentKrw }` — 서버만 씀 | AIU-20·21 |
| `series/{id}` | `name`, `intro`, `styleId`, `mainCharacterIds[]`, `tone`, `pageCount`, `aspect`, `coverPath`, `archivedAt` | EPI-01~03 |
| `submissions/{id}` | `title`, `body`, `source: 'dm'\|'comment'\|'form'\|'self'\|'other'\|'link'`, `sourceNote`, `tags[]`, `starred`, `note`, `status`(glossary 3절), `episodeIds[]`, `createdBy`, `createdAt`, `deletedAt` | INB-01·20~25 |
| `episodes/{id}` | 아래 표 | EPI, STU |
| `characters/{id}` | `name`, `aliases[]`(역할 이름), `intro`, `appearance: { age, gender, build, hair, eyes, marks, outfit }`, `appearanceText`(그림 생성용, 항목에서 자동 작성 후 수정), `episodeId`(이번 에피소드만이면 id), `refImages[]`(Storage 경로, 최대 5), `coverPath`, `archivedAt`, `deletedAt` | CHR-01~04·07·11 |
| `styles/{id}` | `name`, `description`, `line: thin\|bold\|none`, `coloring: flat\|watercolor\|cel`, `palette: pastel\|vivid\|mono\|custom`, `paletteColors`, `background: plain\|simple\|detailed`, `negative`, `rightsConfirmed`, `refImages[]`, `samples[]`·`sampleJobId`(서버만), `version`, `archivedAt`, `deletedAt` | STL-01~04·08·09 |
| `aiJobs/{jobId}` | [ai-jobs.md](./ai-jobs.md) 2절 — 서버만 씀 | AIU |
| `notifications/{id}` | `uid`, `kind`, `targetPath`, `readAt`, `createdAt` | CMN-10 |

### `episodes/{id}`
| 필드 | 내용 |
| --- | --- |
| `seriesId`, `title`, `number` | EPI-10·15 |
| `step` | 현재 단계 `'story'\|'storyboard'\|'illustrate'\|'review'\|'export'` |
| `status` | `'active'\|'done'\|'published'` + `archivedAt` (glossary 3절) |
| `settings` | `{ tone, pageCount, narrator, aspect, styleId, characterIds[], extraRequest }` (STO-02) |
| `submissionIds[]` | 재료 썰 여러 개 (#21) |
| `activeStoryVersionId` | 사용 중 각색안 (STO-22). 첫 AI 안이 생기면 서버가 채운다 |
| `analysis` | 서버만: `{ summary[], characters: { name, role }[], points[], sensitive: { text, reason }[], jobId }` (STO-10) |
| `storyVersionCount` | 서버만: 각색안 번호("N안") 매기기 |
| `storyboardJobId` | 서버만: 마지막으로 반영한 자동 콘티 작업 (같은 작업을 두 번 반영하지 않음, SBD-01·02) |
| `staleFrom` | `'story'`: 콘티가 있는데 사용 중 각색안이 바뀜 (STO-22) |
| `pageOrder[]` | 장 id 순서 |
| `staleFrom` | `null` 또는 영향 받은 첫 단계 (STU-12) |
| `costKrw` | 이 에피소드에 쓴 AI 비용 합계 — 서버만 (EPI-17) |
| `updatedAt`, `createdAt`, `deletedAt` | |

### 에피소드 하위
| 경로 | 주요 필드 | 기능 |
| --- | --- | --- |
| `storyVersions/{id}` | `label`("2안"), `source: 'ai'\|'manual'`, `logline`, `scenes: { id, heading, beats, dialogues: { speaker, type, text }[] }[]`, `punchline`, `titleCandidates[]`, `settings`(만들 때 톤·장 수·화자·추가 요청), `jobId`, `basedOn`, `editedAt`, `createdAt`. AI 안은 서버가 문서 id = jobId로 만든다. 편집자는 `label·logline·scenes·punchline·editedAt`만 고친다 | STO-11~14·20~23 |
| `pages/{id}` | `layout: '1'\|'2v'\|'2h'\|'3'\|'4'`, `panelIds[]`(배치 순서), `deletedAt` | SBD-20·23 |
| `panels/{id}` | `pageId`, `scene`, `place`, `mood`, `characterNames[]`(이름. 캐릭터가 등록되면 `characterIds`로 연결, 1-G), `characterIds[]`, `shot`, `expression`, `action`, `outfit`, `note`, `dialogues: { id, type, speaker, speakerId, text }[]`, `selectedCandidateId`, `crop: { x, y, w, h }`(0~1 비율), `bubbles: { dialogueId, x, y, w, h, shape, tail, fontSize, bold }[]`, `staleFrom`, `deletedAt` | SBD-10~13, ILL-11·23, REV-01~03 |
| `panels/{id}/candidates/{id}` | `imagePath`, `previewPath`, `width`, `height`, `source: 'ai'\|'upload'`, `jobId`, `input`(생성 입력 스냅숏: 장면·캐릭터·그림체 id와 `version`·모델), `hidden`, `favorite`, `createdAt` — 서버만 만듦 | ILL-01·03·10~14 |
| `typeset` (문서 하나: `episodes/{id}/meta/typeset`) | `font`, `fontSize`, `lineHeight`, `strokeWidth`, `strokeColor` — 작품 기본값을 복사해 시작 | REV-04 |

- 장·컷 순서는 부모 쪽 배열(`pageOrder`, `panelIds`)로 둔다. 끌어서 옮기기(SBD-21)가 문서 하나 수정으로 끝난다.
- 대사는 컷 문서 안 배열. 말풍선은 `dialogueId`로 대사를 가리켜, 대사를 고치면 말풍선 글도 같이 바뀐다(REV-02).

### 3단계 이후 (제보함·발행)
| 경로 | 내용 |
| --- | --- |
| `intake/{slug}` | 공개 제보 링크 → `workspaceId`, `enabled`, 안내·주제·동의 문구 (INB-02~04) |
| `workspaces/{ws}/submissions/{id}/private/contact` | 제보자 이메일·닉네임. 소유자·관리자만 읽기, 편집자 화면에는 "알림 받기 켜짐"만 (INB-15) |
| `workspaces/{ws}/consents/{id}` | 동의 기록: 문구 버전, 체크 항목, 시각, 철회 시각 (INB-10~12) |
| `workspaces/{ws}/publications/{id}` | 발행 기록: 에피소드, 게시일, 링크, 캡션 (PUB-20~23) |
| `episodes/{id}/meta/video` | 영상 설정: `aspect`, `unit: 'panel'\|'page'`, `clips: { panelId, durationMs, motion, motionStrength, transition, transitionMs, bubbleReveal }[]`(타임라인 순서), `musicPath`, `musicVolume`, `musicFadeOutMs`, `coverPanelId` (PUB-30~38) |
| `workspaces/{ws}/refs/music/{file}` (Storage) | 올린 배경음악 (PUB-36, 편집자, `audio/*`, 20MB 이하) |

## 2. Storage
| 경로 | 내용 | 쓰기 |
| --- | --- | --- |
| `workspaces/{ws}/images/{imageId}/original.{png\|webp}` | 생성·올린 원본 | 서버 (올리기는 2단계부터 클라이언트 → 임시 경로 → 서버가 옮김) |
| `workspaces/{ws}/images/{imageId}/preview.webp` | 긴 변 768px 미리보기 | 서버 |
| `workspaces/{ws}/refs/{characters\|styles}/{id}/{file}` | 캐릭터·그림체 참조 이미지 (CHR-04, STL-02) | 편집자 (이미지, 10MB 이하) |
| `workspaces/{ws}/uploads/{uid}/{file}` | 올리기 임시 (ILL-30, 2단계) | 본인 |

- 선택 안 된 후보 정리(AST-07, 2단계)와 휴지통 30일 삭제(CMN-30)는 예약 함수가 문서와 파일을 함께 지운다.

## 변경 이력
- v0.1: 초안. 원본 7-2절 구조를 워크스페이스 하위로 옮기고 작품·장·후보·사용량 추가
- v0.2: 영상 설정 문서·음원 경로 추가 (3단계)
- v0.3: 1-E — 에피소드 `analysis`·`storyVersionCount`·`staleFrom`, 각색안 `logline`·`punchline`·`settings`·`editedAt` (분석은 각색안이 아니라 에피소드에)
- v0.4: 1-F — 컷 `place`·`mood`·`characterNames`, 대사 `speaker`, 에피소드 `storyboardJobId`. 다시 나누기는 기존 장·컷을 soft delete
- v0.5: 1-G — 캐릭터 `aliases`·`intro`·외형 항목·`appearanceText`·`episodeId`·`coverPath`, 그림체 항목 값·`rightsConfirmed`·`sampleJobId`. 캐릭터 후보·그림체 미리 보기는 `style.sample` 작업 (`params.prompts[]`·`refPaths[]`)
- v0.6: 1-H — 후보 id `${jobId}_${i}`(그림은 `aiJobs/{jobId}/{i}.png`), 고른 그림이 없으면 첫 후보를 자동 선택. `panel.image` params `{ prompt, n, negative, refPaths[], input }`
- v0.7: 1-I — 말풍선 `bubbles[]` 좌표는 컷 안 0~1 비율, `shape`=대사 종류, `tail`: `none|bl|b|br|tl|tr`. `meta/typeset.font`: `pretendard|gowun-dodum|jua` (SIL OFL 1.1)
- v0.8: 1-J — 에피소드 `settings.format: 'jpg'|'png'`, `settings.aiLabel`(기본 켜짐). 출력은 저장하지 않고 브라우저에서 바로 내려받기. Storage 버킷 CORS는 `storage.cors.json`을 `main` 배포 때 CI가 적용
- v0.9: 1-K — 휴지통 되살리기·바로 삭제는 callable `restoreFromTrash`·`purgeFromTrash`(하위 문서까지 `recursiveDelete`), 30일 지난 것은 `purgeExpiredTrash`(매일 04:00 KST). 알림은 `aiJobs` 최근 30개 + 사용량으로 앱에서 계산하고 읽은 시각은 브라우저에 저장
