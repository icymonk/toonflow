# toonflow

AI 인스타툰 제작 SaaS **TOONFLOW**. 기획·기능명세 **확정** v1.0 (2026-10-19). 개발 문서 `docs/dev/` 초안, 0단계 개발 시작.

## Docs
- 기획 문서는 `docs/` (목차·문서 상태: `docs/README.md`). 기본 기획 `docs/planning/`, 기능명세 `docs/features/`, 브랜드·UI 디자인 `docs/design/`.
- 사용자가 준 원본 기획은 `docs/brief/toonflow-brief.md`에 **그대로** 둔다 (수정 금지). 원본과 다르게 정한 것은 `docs/planning/open-questions.md`의 "2. 결정됨"에 남기고, 결정이 원본보다 우선한다.
- 진행 순서: 기능명세 작성 → 리뷰 → 확정 → 그 다음 개발 문서(`docs/dev/`).
- 기능명세와 개발 문서가 충돌하면 기능명세가 우선.
- 확정 문서를 바꿀 때는 문서 상단 버전을 올리고 변경 이력에 남긴다.
- 기능명세에는 개발 용어(저장 방식, 기술명, 필드명)를 쓰지 않는다. 기능마다 ID(`STU-01` 등)를 붙인다. 접두어 목록은 `docs/README.md`.
- 새 미결 사항은 `docs/planning/open-questions.md`의 "1. 미결"에 추가하고, 결정되면 "2. 결정됨"으로 옮긴다.
- 제품 안 용어(메뉴명, 제작 단계명, 상태명)는 `docs/planning/glossary.md`가 원본. 화면 문구·문서 모두 이 표를 따른다.

## Dev decisions
- Nuxt 5 nightly SPA + shadcn-vue + Tailwind + Firebase, pnpm (open-questions #1, memorize·boardlab과 같은 구성). 개발 결정·작업 순서는 `docs/dev/README.md`, `docs/dev/phase-plan.md`.

## Branches
- `main`(운영) ← `develop`(기본) ← 기능 브랜치. 기능 PR은 `develop`으로.

## Commands
- Package manager: **pnpm** (npm 사용 금지, `package-lock.json` 만들지 않기)
- Dev: `pnpm dev`
- Static build (Firebase Hosting): `pnpm generate` -> `.output/public`
- Unit tests: `pnpm test` (Vitest; `shared/**`, `app/**`, `functions/src/**` 의 `*.test.ts`)
- Typecheck: `pnpm typecheck`
- Functions build: `pnpm functions:build` (esbuild로 `functions/src` + `shared/` 번들 → `functions/lib`)
- Add shadcn component: `pnpm dlx shadcn-vue@latest add <name>`

## Repo layout
- `app/` Nuxt 앱, `shared/` 앱·서버 공용 순수 코드(Nuxt에서는 `#shared`), `functions/` Cloud Functions (pnpm 워크스페이스 패키지). 상세는 `docs/dev/architecture.md` 2절.
- 화면 문구는 `app/locales/ko.ts`에 모은다. 색·반경 토큰은 `app/assets/css/tailwind.css` (`docs/design/ui-system.md` 기준).
- `pnpm-workspace.yaml`의 `allowBuilds`는 설치 스크립트 허용 목록(보안 설정). 새 패키지가 빌드 스크립트를 요구하면 임의로 true로 바꾸지 말고 사용자에게 묻는다.

## Environment notes (memorize와 같음)
- `typescript`는 `^6`으로 고정. TS 7은 JS API가 없어 Vue 도구와 shadcn-vue CLI가 깨진다.
- shadcn-vue CLI가 Nuxt 5를 인식하지 못해 루트 `tsconfig.json`의 `compilerOptions.paths`(`@/*`)로 `add`가 동작한다. 지우지 않는다.
- 가입 허용·운영자 권한: GitHub Actions → **Access** → Run workflow (`allow` / `admin` — admin은 그 이메일로 한 번 로그인한 뒤, 적용은 다시 로그인). 로컬에서는 `GOOGLE_APPLICATION_CREDENTIALS=<서비스계정.json> node functions/scripts/{allow-email,set-admin}.mjs <email>`. 운영자 설정 화면은 `/admin`.
- Storage 규칙이 `firestore.exists/get`(멤버 확인)을 쓰므로, 프로젝트마다 한 번 Storage 서비스 에이전트 `service-<프로젝트 번호>@gcp-sa-firebasestorage.iam.gserviceaccount.com`에 **Firebase Rules Firestore Service Agent** 역할이 있어야 한다. `firebase deploy --non-interactive`는 이 역할을 붙이지 않고 넘어가고, 없으면 모든 이미지 읽기가 403이다.
