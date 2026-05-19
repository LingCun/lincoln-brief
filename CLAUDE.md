# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Lincoln Brief is a Korean-language US/KR market briefing blog. It is half publication, half automation pipeline — cron jobs scrape market data and emit draft posts with `[TODO: Lincoln 검토]` markers, and Lincoln (the human) fills in the analysis before publishing.

## Commands

```powershell
npm run dev                  # dev server at http://localhost:4321 (search NOT available in dev)
npm run build                # astro build + pagefind --site .vercel/output/static
npm run preview              # preview built site, search works here

npm run fetch:market         # refresh src/data/market-snapshot.json from Yahoo Finance (+ KRX if KRX_API_KEY)
npm run generate:daily-brief # generate today's draft post + SVG thumbnail from the snapshot
npm run inline:thumbnails    # MUST run after creating/editing any thumbnail SVG that references a photo
```

블로그 글 관리 GUI: `https://lincoln-brief.vercel.app/keystatic` — 자세히는 아래 "CMS — Keystatic admin" 절.

There are no tests, lints, or formatters configured.

## Stack pin (deliberate fallback — see CLAUDE.md in `C:\claude`)

Astro **4.16** (hybrid output) + Tailwind **3.4** + `@astrojs/mdx` 3.x + `@astrojs/vercel@7` serverless adapter + React 18 + Keystatic 0.5.

워크스페이스 표준은 Astro 6 + Tailwind 4 인데, 워크스페이스에 깔린 Node 가 20 이라 Astro 6 를 못 돌림 — 그래서 이 프로젝트는 Node 20 호환 폴백에 의도적으로 머물러 있다. **Node 22 가 확정되기 전엔 Astro 6 / Tailwind 4 로 올리지 말 것.** `@astrojs/sitemap` 도 4.16 호환 이슈로 일시 제거 (`astro.config.mjs` 주석 참고).

추가 핀:
- `@astrojs/vercel@7` 는 Node 20 까지만 지원. `package.json` 의 `engines.node = "20.x"` 가 Vercel 빌드 환경을 Node 20 으로 묶음.
- `output: 'hybrid'` — 페이지는 기본 정적, Keystatic 어드민 (`/keystatic`, `/api/keystatic/*`) 만 SSR 함수로 실행. 따라서 빌드 산출물이 `dist/` 가 아니라 `.vercel/output/static/` 으로 떨어지고, pagefind 도 그쪽을 가리킨다 (`npm run build` 스크립트 참고).

Content collection lives at `src/content/config.ts` (Astro 4 location), not `src/content.config.ts` (Astro 6 location).

## The automation pipeline (the thing that's actually load-bearing)

Three GitHub Actions cron the repo from the outside in:

1. **`refresh-market.yml`** — 매 10분, `npm run fetch:market` → `src/data/market-snapshot.json` 변화 있을 때만 커밋. 홈 라이브 티커·MarketSnapshot 카드의 원천.
2. **`daily-brief.yml`** (US) — 평일 **06:00 KST** (= 일~목 21:00 UTC). `MARKET=US` 로 `generate:daily-brief` 실행 → 미국 4개 카테고리 초안 (`daily-brief / stock-analysis / market-forecast / economy-issue` × 1) + 썸네일 4개 자동 생성·커밋. 슬러그 접두 없음.
3. **`kr-daily-brief.yml`** (KR) — 평일 **16:00 KST** (= 월~금 07:00 UTC, 한국 마감 15:30 직후). `MARKET=KR` 로 같은 스크립트 실행 → 한국 4개 카테고리 초안 + 썸네일. 슬러그 접두 `kr-`.

세 워크플로우 모두 Node 22 in CI (CI 만이 Node 22 가 보장되는 곳). "Lincoln Brief Bot" 으로 main 에 직접 push → Vercel 이 픽업해 재빌드.

### `scripts/generate-daily-brief.mjs` 의 계약

- **자동화 범위**: frontmatter, 가격표 (마켓별 지수·환율), 썸네일 SVG 뼈대 (카테고리 컬러), 섹션 헤더.
- **자동화 안 함**: 분석·통찰·매수/매도 톤. 본문 거의 전부 `[TODO: Lincoln 검토]` 마커로 남음. **마커 있는 글은 미발행 상태로 취급** — 사람이 채워야 발행됨.
- **분기**: `MARKET` 환경변수 ('US' | 'KR', 기본 US). 마켓별로 slug 접두·데이터 소스(`data.us` vs `data.kr`)·title·tags 분기.
- **안전성**: 같은 슬러그가 이미 있으면 덮어쓰지 않음 (`fs.access` 체크 후 skip) → 수동 편집 후 같은 날 두 번째 cron 이 돌아도 손댄 글은 보존됨.
- **날짜**: UTC + 9 시간 으로 KST 기준 stamp 사용. CI 가 UTC 21:00 (06:00 KST) 에 돌아도 슬러그 날짜는 올바른 KST 일자.
- **자동 featured**: 스크립트가 `featured` frontmatter 를 안 씀. 대신 [`src/pages/index.astro`](src/pages/index.astro) 가 본문에 `[TODO: Lincoln 검토]` 있는 글을 메인 노출 후보에서 자동 제외 → 마커 지우면 그 글이 자동으로 featured 슬롯에 등장.

automation owns facts (price tables, thumbnail skeleton); 통찰은 사람이 채운다. Claude 가 분석 단락을 프로그래밍으로 쓰지 말 것.

## CMS — Keystatic admin (`/keystatic`)

블로그 글을 노션식 GUI 로 작성·수정·삭제할 수 있는 어드민. 단지 GitHub API 를 통해 `src/content/blog/*.md` 를 편집하는 껍데기 — 모든 변경은 git commit 으로 남고, Vercel 이 자동 재배포한다. **기존 자동화 스크립트·직접 .md 편집과 충돌 없이 공존.**

### URL · 인증
- Production: `https://lincoln-brief.vercel.app/keystatic`
- 인증: Keystatic GitHub App 으로 OAuth. `LingCun/lincoln-brief` 에 push 권한 있는 깃헙 계정만 로그인 가능 → 사실상 본인만 어드민 사용.
- GitHub App: `github.com/settings/apps` 에서 (이름 예: `lincoln-brief-cms`). Callback URL `https://lincoln-brief.vercel.app/api/keystatic/github/oauth/callback`.

### 필요한 환경변수 (Vercel + 로컬 `.env`)
```
KEYSTATIC_GITHUB_CLIENT_ID
KEYSTATIC_GITHUB_CLIENT_SECRET
KEYSTATIC_SECRET             # 본인이 정한 랜덤 문자열 (32자+)
```
- Vercel: Settings → Environment Variables 에 Production·Preview·Development 모두 세팅. 추가/변경 후 반드시 **Redeploy**.
- 로컬에서 Keystatic 까지 돌리려면 같은 값을 그 PC 의 `.env` 에 복사. `.env` 는 gitignored.

### 작성 흐름 — 3가지 방식 공존
세 방식 모두 같은 `src/content/blog/*.md` 파일을 만들거나 수정한다. 섞어 쓰기 안전.

1. **Keystatic UI** (`/keystatic`) — 노션식. 신규 글 작성·수정·삭제·이미지 업로드 GUI. 저장 = `Update blog/<slug>` 같은 git commit 자동 생성.
2. **직접 .md 편집** — VS Code 에서 `src/content/blog/<slug>.md` 열어서 수정 → `git push` → Vercel 자동 재배포.
3. **자동화 스크립트** — `npm run generate:daily-brief` (운영 중인 매일 06:00 KST 파이프라인, `STYLE.md` 의 규칙을 따름).

**중요**: Keystatic 에서 "신규 글" 만 만들면 새 .md 파일만 추가되고, **기존 글은 한 글자도 안 바뀐다**. 일일 작업이 "4개 카테고리 (데일리 시황 / 종목 분석 / 시장 예측 / 경제 이슈) 새 글 추가" 라면 안전하게 신규 글만 쌓을 수 있음. 기존 글이 건드려지는 경우는 본인이 의식적으로 그 글을 열어서 수정·삭제 누를 때뿐.

### 본문 파일 형식 (.md, 확장자 매칭이 중요)
`keystatic.config.ts` 에서 `content: fields.mdx({ extension: 'md' })` 로 고정. **이 `extension: 'md'` 빼면 Keystatic 이 `.mdx` 만 찾아서 대시보드에 0 entries 로 표시된다.** 신규 글도 `.md` 확장자로 저장됨.

### 알려진 한계
- Keystatic 셋업 위저드 (`/keystatic/setup`) 의 마지막 단계는 로컬 `.env` 에 쓰려고 함. Vercel 서버리스에선 실패해 500 으로 떨어진다 (정상, 무시). GitHub App 자체는 그 시점에 이미 생성·설치되므로, `github.com/settings/apps` 에서 직접 Client ID 복사 + Client Secret 발급하면 됨.
- 처음 GitHub App 만들 때 위저드 대신 `github.com/settings/apps/new` 에서 직접 만드는 게 더 깔끔. 필수 설정: Callback URL, Webhook **off**, Contents/Pull requests **Read & write**, "Request user authorization (OAuth) during installation" **체크**.

## Content authoring rules — read STYLE.md first

`STYLE.md` is the source of truth for tone, structure, frontmatter, and thumbnail conventions. Before writing or editing a post, read it. Highlights that are easy to miss:

- **Reference blog is `https://blog.naver.com/press02`** — and `WebFetch` is blocked from `naver.com`, so you cannot fetch it directly. If the user wants something done "in press02 style," ask them for excerpts or work from memory.
- **Dual-source rule** — every numeric claim or news item needs at least two source URLs in the post's `sources:` frontmatter.
- **No buy/sell language** — "관찰 가치 있음 / 분할 매수 영역" not "매수 추천."
- **Sign-off** — every post ends with `— Lincoln` (em-dash + space).
- **Categories are an enum** from `src/consts.ts`: `daily-brief | stock-analysis | market-forecast | economy-issue`. Adding a category requires editing `consts.ts` (used by `content/config.ts` zod enum AND by `pages/category/[slug].astro` AND by `keystatic.config.ts` select options).
- **Market label** (`market` frontmatter): `'KR' | 'US' | 'GLOBAL'`. 생략 시 `src/lib/market.ts` 의 `detectMarket()` 가 slug 접두 (`kr-` → KR, `trump-xi-` · `oil-iran-` 등 → GLOBAL) 와 태그(KOSPI/NVDA 등) 기반 자동 추정. Keystatic UI 에서는 select 드롭다운.

## Thumbnails — the base64 gotcha

Thumbnails are 1280×720 SVGs at `public/thumbnails/<slug>.svg`. When an SVG includes a photo background via `<image href="/thumbnails/photos/...">`, **the photo MUST be base64-inlined before commit.** Reason: when an SVG is loaded via `<img src="">`, browsers apply the SVG-as-image sandbox and block external resource loads — the photo silently disappears in production.

Workflow:
1. Author the SVG referencing the photo by path (easy to edit).
2. Run `npm run inline:thumbnails` — converts every `<image href="/thumbnails/photos/...">` in `public/thumbnails/*.svg` to `data:image/jpeg;base64,...`. Idempotent.
3. Commit the now-self-contained SVG.

When adding a new photo to `public/thumbnails/photos/`, also append a row to `public/thumbnails/photos/_ATTRIBUTION.md` (source URL, license, slug). Photo licensing rules are in `STYLE.md` — public-domain / Unsplash / Pexels / official press kits are safe; anything else needs explicit verification.

## Korean market data — `korea-stock` MCP

`.mcp.json` registers the `korea-stock-mcp` server (KRX + DART). It needs `DART_API_KEY` and `KRX_API_KEY` in the environment (see `.env.example`, key-issuance steps in `docs/API_KEYS.md`). When these are missing the cron falls back to Yahoo's `^KS11` / `^KQ11` for index closes only — anything that needs foreign-flow / trading-value / disclosure data requires the MCP, so flag the missing key rather than silently producing a thinner post.

## Where things live

- `src/content/blog/*.md` — posts. Slug pattern: `<topic>-YYYYMMDD.md` (e.g. `kr-samsung-20260518.md`, `daily-brief-20260516.md`). KR posts are prefixed `kr-`.
- `src/content/config.ts` — content collection schema (zod). `market` 필드는 `''` 도 허용 (Keystatic "자동 추정" 옵션 호환 위해 `z.preprocess` 로 undefined 변환).
- `src/data/market-snapshot.json` — written by `fetch-market.mjs`, read by `MarketSnapshot.astro` and `generate-daily-brief.mjs`. Has `snapshot[]` (legacy ticker list) AND `kr.top12 / us.top12` (current homepage cards) — both shapes are still consumed.
- `src/consts.ts` — site metadata + the `CATEGORIES` array + Stibee subscribe URL placeholder. Changes here ripple into content schema, category routes, AND Keystatic select options.
- `src/lib/market.ts` — KR/US/GLOBAL 자동 추정 헬퍼 (`detectMarket(post)`).
- `src/pages/category/[slug].astro` — dynamic category index pages, generated from `CATEGORIES`.
- `keystatic.config.ts` (repo root) — CMS schema. Mirrors `src/content/config.ts` but with GUI field types (select, date picker, array, mdx editor 등). 카테고리 추가 시 `consts.ts` 만 바꿔도 자동 반영 (이 파일이 `CATEGORIES` 를 import).
- `public/thumbnails/_template-photo.svg` — copy this as the starting point for new photo-style thumbnails.

## Memory directory note

The user's auto-memory directory for this project lives at `C:\Users\김동진\.claude\projects\C--claude-lincoln-brief\memory\` (note the project-specific path; the workspace-wide one at `C--claude\memory\` is separate). Write project-scoped memories here.
