# toonflow

AI 인스타툰 제작 SaaS **TOONFLOW**. 기획·기능명세 **확정** v1.0 (2026-10-19). 개발 문서 `docs/dev/` 초안 (코드 없음).

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
