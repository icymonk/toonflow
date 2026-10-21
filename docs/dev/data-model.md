# 데이터 구조

> 상태: 초안 · v3.4 · 2026-10-21 — 원칙: 워크스페이스 데이터는 모두 `workspaces/{wsId}` 아래(R2). 금액은 원 단위 정수(R10). 시각은 `Timestamp`.

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
| `snapshots/{id}` | `name`, `createdBy`, `createdAt`, `title`, `pageOrder`, `activeStoryVersionId`, `pages[]`, `panels[]` — 만들기·지우기만 | STU-23 |

- 장·컷 순서는 부모 쪽 배열(`pageOrder`, `panelIds`)로 둔다. 끌어서 옮기기(SBD-21)가 문서 하나 수정으로 끝난다.
- 대사는 컷 문서 안 배열. 말풍선은 `dialogueId`로 대사를 가리켜, 대사를 고치면 말풍선 글도 같이 바뀐다(REV-02).

### 3단계 이후 (제보함·발행)
| 경로 | 내용 |
| --- | --- |
| `intake/{slug}` | 공개 제보 링크 → `workspaceId`, `enabled`, `name`(작가 이름), `intro`, `topics`, `questions[]`(5개까지), `images`(첨부 받기, 기본 끔). `slug`는 무작위 12자. 하위 `rate/{ip해시}`(`times[]`, 서버만)로 10분 3번 제한 (INB-02~06) |
| `workspaces/{ws}/config/intake` | `slug`, `bannedWords[]`(100개까지). 멤버 읽기, 소유자·관리자 쓰기 (INB-03·05) |
| `workspaces/{ws}/submissions/{id}/private/contact` | 제보자 `email`·`nickname`. 제보 문서에는 `notify`(이메일 남김)·`attachments[]`(Storage `workspaces/{ws}/intake/{id}/`, 서버만 씀)·`consent`(`text`·`at`)·`createdBy: 'intake'`만. 소유자·관리자만 읽기, 편집자 화면에는 "알림 받기 켜짐"만 (INB-15) |
| `invites/{sha256(token)}` | 초대 링크: 워크스페이스, 역할, 만료, 만든 사람, 참여 수 (ACC-20, 서버만 쓰고 관리자 이상이 봄) |
| `waitlist/{sha256(email)}` | 대기 명단: 이메일, 이름, 인스타그램 계정, 메모, 상태(대기·승인·거절), 처리 시각·운영자 (CMN-41·52, 서버만 쓰고 운영자만 읽음) |
| `workspaces/{ws}/bubbleTemplates/{id}` | 말풍선 템플릿: 이름, 모양·꼬리·글자 크기·굵게·크기 (REV-07, 편집자가 만들고 지움) |
| `workspaces/{ws}/consents/{id}` | 동의 기록: 문구 버전, 체크 항목, 시각, 철회 시각 (INB-10~12) |
| `workspaces/{ws}/publications/{id}` | 발행 기록: 에피소드, 게시일, 링크, 캡션 (PUB-20~23) |
| `episodes/{id}/meta/video` | 영상 설정: `aspect: '9:16'\|'4:5'`, `unit: 'panel'\|'page'`, `clips: { [panelId 또는 pageId]: { durationMs, motion, strength, transition, transitionMs, reveal } }`(고친 컷만, 순서는 콘티 순서를 따른다). 표지 화면 시간은 `cover:{id}` 키, `musicPath`, `musicVolume`, `musicFadeOutMs`, `musicLoop`, `coverId` (PUB-30~38) |
| `workspaces/{ws}/refs/music/{episodeId}/{file}` (Storage) | 올린 배경음악 (PUB-36, 편집자, `audio/*`, 20MB 이하) |

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
- v1.0: 2-A — `submissions.maskedBody`(가린 글, 각색 재료로 우선), `episodes.review`(검수 항목별 `unchecked`·`needs`·`pass`, 작품 항목은 `custom:<이름>`), `series.reviewItems`(작품별 검수 항목)
- v1.1: 2-B — `episodes.caption`(`text`·`hashtags`, AI 작업 `publish.caption`이 채우고 작가가 고침), `episodes.published`(`at`·`url`, 상태 `published`와 함께), `series.hashtags`·`greeting`·`watermark`
- v1.2: 2-C — `series.memo`(연재 메모), `characters.personality`·`speech`(말투 예시 3개까지), 글 작업 params `context`(작품 참고)·`rewrite`(부분 다시 쓰기, 새 작업 `story.rewrite`. 결과는 앱이 받아서 그 장면에 넣음)
- v1.3: 2-D — `panels.refImage`(구도·포즈 참고, Storage `refs/panels/{panelId}/…`, 그림 생성 참조 이미지 맨 앞), `series.coverText`·`outroText`(고정 장 문구). 장면 다듬기는 `story.rewrite`의 `refine` 모드
- v1.4: 2-E — 후보 `favorite`·`hidden`은 편집자가 바꿀 수 있음(그 두 필드만), `panels.styleId`(이 컷만 다른 그림체)
- v1.5: 2-E — 변형·부분 수정은 `panel.image` 작업 그대로, 고른 후보 경로를 `refPaths` 맨 앞에(부분 수정은 마스크 PNG `refs/panels/{panelId}/…`를 둘째로) 넘긴다
- v1.6: 2-F — 후보에 `workspaceId`·`episodeId`·`panelId`(collectionGroup 모아 보기, 색인 2개), 후보 `source`에 `import`, `workspaces/{ws}/assets/{id}`(참고 자료: path·name·size·tags·createdBy·createdAt, Storage `refs/assets/`), callable `cleanupCandidates`·`storageUsage`
- v1.7: 2-G — 캐릭터 `variants: { kind: 'expression'|'outfit', label, path }[]`(최대 12, 컷 `expression`·`outfit` 글에 `label`이 들어 있으면 대표 이미지 대신 참조), 이미지 작업 `prompts` 최대 6개(캐릭터 시트)
- v1.8: 2-H — `episodes/{id}/snapshots/{id}`(STU-23): `name`(1~40자), `createdBy`, `createdAt`, `title`, `pageOrder`, `activeStoryVersionId`, `pages[]`·`panels[]`(각 80개 이하, 컷은 편집자가 쓰는 필드만 복사). 만들기·지우기만, 고치기 없음. 되돌리기는 지금 상태를 먼저 스냅숏으로 남긴 뒤 장·컷을 다시 쓰고, 그 뒤에 생긴 장·컷은 `deletedAt`
- v1.9: 2-I — `episodes.number`는 편집자가 고칠 수 있음(정수 1~9999), `episodes.duplicatedFrom`(복제 원본, `duplicateEpisode`만 씀), `submissions.aiSummary`(`summary[≤3]`·`genre`·`score` 0~100·`reason`·`jobId`, 서버만 씀), collectionGroup `candidates(workspaceId, imagePath)` 색인(정리 때 같은 파일을 쓰는 후보 확인)
- v2.0: 3-A — `meta/video` `clips`를 컷·장 ID 키의 맵(고친 컷만)으로, `musicLoop`·`coverId` 추가, 음원 경로 `refs/music/{episodeId}/{file}`
- v2.1: 3-C — `intake/{slug}` 필드·`rate` 하위, `workspaces/{ws}/config/intake`, 링크 제보의 `notify`·`attachments`·`consent`, 공개 callable `submitIntake`(받기 꺼짐·30자 미만·금칙어·10분 3번 초과 거절, 이미지는 머리 바이트로 PNG/JPEG/WebP만·장당 2MB). 올리거나 가져온 후보(id에 `_` 없음)의 그림은 후보 문서 `imagePath`에서 찾는다
- v2.2: 3-D — `intake/{slug}.consentText`(작가가 고친 동의 문구, 비면 기본), 링크 제보 `consent.credit`·`consent.notify`, `credit`(크레딧에 동의한 닉네임), `withdrawn: { at, published }`. 확인 링크 토큰은 `intakeTokens/{sha256(token)}` → `{ workspaceId, submissionId }`(서버만). 공개 callable `intakeStatus`·`withdrawIntake`: 게시 전 철회는 `status: 'withdrawn'` + 본문·첨부·연락처 삭제, 게시 후는 `withdrawn.published: true`만. 에피소드 `settings.creditPlace: 'caption'|'page'`(기본 캡션). 이메일 발송은 아직 없음(확인 링크에서 게시 링크를 본다)
- v2.3: 3-E — `reports/{id}` `{ kind: 'page'|'submission', slug, workspaceId, submissionId?, reason, detail, status: 'open'|'resolved', by, action?, note?, resolvedBy?, log[] }`(서버가 만들고 운영자만 읽음), `intakeBlocks/{slug}` `{ workspaceId, reportId, by, at }`(누구나 읽고 서버만 씀, 있으면 `submitIntake` 거절). callable `reportPage`(공개, 10분 3회)·`reportSubmission`(편집자 이상)·`resolveReport`(admin 클레임). 비슷한 제보(INB-26)는 저장하지 않고 화면에서 2글자 조각 유사도 0.6 이상을 묶는다
- v2.4: 3-F — 컷 `adjust { brightness, contrast, saturate }`(%, 없으면 그대로. 화면은 CSS filter, 출력·릴스는 Canvas filter), 에피소드 `settings.hiRes`(PUB-07 2배 크기 출력)·`settings.plannedAt`(PUB-23 YYYY-MM-DD 메모, Home 오늘 할 일에 표시). 콘티 내보내기(SBD-32)는 저장 없이 대본 보기에서 .txt 내려받기·인쇄 창(PDF 저장)
- v2.5: 3-G — 에피소드 `aiCheck: { mode: 'quality'|'consistency', items: [{ panelId, issue }], count, jobId, at }`(서버만, 마지막 결과 하나). AI 작업 `panel.check`: 글 모델에 컷마다 고른 그림(후보 문서 `imagePath`)을 같이 넘김, 12컷까지. `workspaces/{ws}/bubbleTemplates/{id}` `{ name, shape, tail, fontSize, bold, w, h, createdBy, createdAt }`(고치기 없음)
- v2.6: 4-A — `waitlist/{sha256(email) 앞 32자}` `{ email, name, handle, note, status: 'pending'|'approved'|'rejected', createdAt, decidedAt?, decidedBy? }`. 공개 callable `joinWaitlist`(같은 곳에서 10분 3회 `waitlistRate/r_{sha}`, 숨은 칸이 채워지면 조용히 버림, 같은 이메일은 한 건), `decideWaitlist`(admin 클레임, 승인 시 `config/access.allowedEmails`에 arrayUnion)
- v2.7: 4-B — `users/{uid}.workspaceIds[]`(속한 워크스페이스, 4-B 전 계정은 `workspaceId` 하나로 대신), `workspaceId`는 마지막으로 연 워크스페이스. 워크스페이스 `deleteAt`(삭제 예약, 7일 뒤)·`deletedBy`, 멤버 문서 `email`·`displayName`(만들 때 토큰에서). 계정 삭제는 `users/{uid}.deletedAt`·`purgeAt`(30일 뒤) + Auth 계정 사용 중지. callable `createWorkspace`(소유 10개까지)·`switchWorkspace`·`deleteWorkspace`(소유자, 마지막 남은 것은 거절)·`restoreWorkspace`·`transferOwnership`(관리자에게만)·`deleteAccount`(소유한 워크스페이스가 남아 있으면 거절). 매일 04:30 `purgeDeleted`가 유예가 끝난 워크스페이스(Firestore·Storage)와 계정을 지운다
- v2.8: 4-C — `invites/{sha256(token)}` `{ workspaceId, role: 'admin'|'editor'|'viewer', expiresAt, createdBy, usedCount, createdAt }`(토큰은 만들 때 한 번만 보여 줌). 멤버 문서 `lastActiveAt`(본인만, `request.time`), `monthlyLimitKrw`(멤버 한도, null이면 없음), `invitedBy`. `usage/{yyyymm}.byMember.{uid}`(실제 비용, 작업 `requestedBy` 기준). callable `createInvite`·`revokeInvite`·`inviteInfo`·`acceptInvite`(허용 목록과 관계없이 멤버 + users 문서)·`setMemberRole`·`removeMember`·`leaveWorkspace`(소유자 거절)·`setMemberLimit`. 소유자는 소유자 밖 역할을, 관리자는 편집자·보기 전용만 주고 바꾼다
- v2.9: 4-D — `workspaces/{ws}/activity/{id}` `{ uid, action, meta, at }`(CMN-31, 서버가 멤버·초대·워크스페이스 관리 callable에서 남김, 멤버가 읽음), `workspaces/{ws}/adminViews/{id}` `{ by, email, reason, workspaceId, at }`(CMN-54, `logAdminView`가 남김, 소유자·관리자·운영자가 읽음, collectionGroup 단일 필드 색인 `at` 내림차순 — `fieldOverrides`, 1필드 복합 색인은 배포가 400으로 거절). callable `adminOverview`(이번 달 워크스페이스별 비용·작업 수·실패율·모델별), `logAdminView`(열람 이유 필수, 에피소드·제보·멤버 수를 돌려줌)
- v3.0: 4-E — `workspaces/{ws}/episodes/{ep}/presence/{uid}` `{ name, photoURL, panelId, at }`(STU-24, 각자 자기 문서만 쓰고 `at`은 서버 시각, 30초마다 갱신·75초 지나면 안 보임, 나갈 때 지움). 새 워크스페이스에 기본 그림체 4개를 `styles`에 `preset: true`로 복사(STL-03). 다크 모드는 UI 토큰만, 저장 데이터 없음.
- v3.1: PUB-24 — `workspaces/{ws}.instagram` `{ userId, username, expiresAt, connectedAt }`(서버만 씀), `instagramTokens/{ws}` `{ accessToken, userId, issuedAt, expiresAt, by }`·`instagramStates/{state}` `{ workspaceId, uid, expiresAt }`(규칙 없음 = 서버만). 게시할 장은 `workspaces/{ws}/exports/{ep}/{batch}/{NN}.jpg`(편집자가 올리고 게시 뒤 서버가 지움). 게시하면 에피소드 `published.instagramMediaId`. callable `instagramAuthUrl`·`connectInstagram`·`disconnectInstagram`·`publishInstagram`, 매일 `refreshInstagramTokens`. 시크릿 `INSTAGRAM_APP_ID`·`INSTAGRAM_APP_SECRET`(없으면 `unset`)
- v3.2: PUB-24 게시를 비동기로 — `publishInstagram`은 에피소드 `instagramPost` `{ status: 'posting', at, by }`와 `instagramPosts/{id}` `{ workspaceId, episodeId, paths, caption, by, createdAt }`(서버만)를 만들고 바로 끝난다. 트리거 `postInstagram`(문서 생성, 300초, 재시도 없음)이 게시한 뒤 `published`를 쓰고 `instagramPost`를 지우거나 `{ status: 'failed', error }`로. 게시 중 표시가 10분 지나면 다시 게시할 수 있다. Hosting `/fn` 경유 callable은 60초에 끊겨서 캐러셀을 기다리면 화면에 실패로 보였다
- v3.3: PUB-25 Threads — Instagram과 같은 구조로 `workspaces/{ws}.threads`, `threadsTokens/{ws}`·`threadsStates/{state}`·`threadsPosts/{id}`(서버만), 에피소드 `threadsPost`·`threadsPublished { at, url, mediaId }`(발행 기록 `published`가 없을 때만 Threads 링크로 채움). callable `threadsAuthUrl`·`connectThreads`·`disconnectThreads`·`publishThreads`, 트리거 `postThreads`, 매일 `refreshThreadsTokens`. 시크릿 `THREADS_APP_ID`·`THREADS_APP_SECRET`
- v3.4: SNS 게시 작업을 `workspaces/{ws}/socialPosts/{id}` `{ platform: 'instagram'|'threads', episodeId, paths, caption, by, status: queued|running|succeeded|failed, progress: { step: prepare|process|publish, done, total }, url, error, createdAt, startedAt, finishedAt }`로 옮김(멤버가 읽고 서버만 씀, 남겨 둠). 트리거 `postInstagram`·`postThreads`를 `postSocial` 하나로 합침. `instagramPosts`·`threadsPosts`는 쓰지 않는다. AIU-01 대기열 패널이 `aiJobs`(40개)와 `socialPosts`(20개)를 함께 보여 준다
