# Lincoln Brief — PM 산출물 + 옵시디언 Git 동기화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lincoln Brief 사이트의 PM 산출물 4종을 옵시디언 볼트(`C:\claude\vault\개인\lincoln-brief\`)에 작성하고, 볼트 전체를 GitHub private repo 로 동기화해 다른 PC 에서 `git clone` 한 번으로 동일하게 사용할 수 있게 한다.

**Architecture:** 볼트(`C:\claude\vault\`)를 그 자체로 git repo 로 변환한다. PM 산출물 4종은 frontmatter + 옵시디언 internal link 형태의 .md 로 `vault/개인/lincoln-brief/` 에 저장. GitHub private repo 를 원격으로 등록해 수동 `git push/pull` 로 PC 간 sync.

**Tech Stack:** Markdown (Obsidian-flavored), Git, GitHub CLI (`gh`). 코드 변경 없음 — Lincoln Brief 소스는 손대지 않음.

**참고 디자인:** [docs/superpowers/specs/2026-05-19-lincoln-brief-pm-and-obsidian-sync-design.md](../specs/2026-05-19-lincoln-brief-pm-and-obsidian-sync-design.md)

---

## File Structure

**생성:**
- `C:\claude\vault\.gitignore` — Obsidian PC-local 상태 + OS junk + 비밀 제외
- `C:\claude\vault\README.md` — 다른 PC 부트스트랩 + 일상 동기화 안내
- `C:\claude\vault\개인\lincoln-brief\01-product-snapshot.md` — 제품 한 페이지
- `C:\claude\vault\개인\lincoln-brief\02-roadmap.md` — 단·중기 로드맵
- `C:\claude\vault\개인\lincoln-brief\03-backlog-and-open-decisions.md` — 백로그 + 열린 결정
- `C:\claude\vault\개인\lincoln-brief\04-risk-register.md` — 운영 리스크 목록

**수정하지 않음:**
- `C:\claude\lincoln-brief\` 의 모든 소스 (코드 변경 없음)
- `C:\claude\vault\개인\lincoln-brief\2026-05-19 세션 ... .md` (기존 세션 노트 — 링크만)
- `C:\claude\vault\.obsidian\*.json` 의 기존 내용

---

## Task 1: Pre-flight check (환경·볼트 상태 확인)

**Files:** none (read-only checks)

- [ ] **Step 1: git 설치 확인**

Run:
```powershell
git --version
```
Expected: `git version 2.X.X` 같은 출력. 없으면 STOP 후 사용자에게 git 설치 요청.

- [ ] **Step 2: gh CLI 인증 상태 확인**

Run:
```powershell
gh --version
gh auth status
```
Expected: `gh version X.Y.Z` + `Logged in to github.com account <username>`.

- 미인증이면: 사용자에게 `gh auth login` 실행 요청 후 대기.
- `gh` 자체가 없으면: 사용자에게 https://cli.github.com/ 설치 안내 후 대기. 또는 Task 10 에서 GitHub 웹 수동 생성 + `git remote add` 로 우회.

- [ ] **Step 3: vault 위치 & 기존 git 상태 확인**

Run:
```powershell
Test-Path C:\claude\vault
Test-Path C:\claude\vault\.git
```
Expected: `True` / `False`.

- 만약 `.git` 이 이미 존재하면:
  ```powershell
  git -C C:\claude\vault remote -v
  git -C C:\claude\vault log --oneline -5
  ```
  결과를 사용자에게 보여주고 "기존 repo 를 그대로 쓸지 / 새로 시작할지" 1회 확인. **이 시점에 사용자 답을 받기 전엔 Task 2 진행 금지.**

- [ ] **Step 4: 옵시디언 동시 실행 여부 확인**

사용자에게 한 줄 컨펌:
> "지금 옵시디언이 `C:\claude\vault` 를 열고 있나요? 작업 중에 `.obsidian/workspace.json` 가 계속 바뀌면 staged 상태가 흔들리니, 일단 닫아주세요."

사용자가 "닫았다" 또는 "안 열려있다" 라고 응답하면 Task 2 로 진행.

---

## Task 2: vault 를 git repo 로 초기화

**Files:**
- Create: `C:\claude\vault\.gitignore`

- [ ] **Step 1: `.gitignore` 작성**

Write to `C:\claude\vault\.gitignore`:

```gitignore
# Obsidian — PC-local 상태 (워크스페이스, 캐시)
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/cache
.obsidian/types.json

# 휴지통
.trash/

# OS junk
.DS_Store
Thumbs.db
desktop.ini

# 임시 파일
*.tmp
*.swp
*.swo

# 환경변수 / 비밀 (실수 방지)
.env
.env.*
*.key
*.pem
```

- [ ] **Step 2: git init**

Run:
```powershell
git -C C:\claude\vault init
git -C C:\claude\vault branch -M main
```
Expected: `Initialized empty Git repository in C:/claude/vault/.git/` + 브랜치 main 으로 변경.

- [ ] **Step 3: gitignore commit**

Run:
```powershell
git -C C:\claude\vault add .gitignore
git -C C:\claude\vault commit -m "chore: add .gitignore for Obsidian vault"
```
Expected: 1 file changed, 새 commit 생성.

- [ ] **Step 4: 기존 vault 콘텐츠 import commit**

Run:
```powershell
git -C C:\claude\vault add -A
git -C C:\claude\vault status --short
```

`status --short` 출력을 확인 — `.obsidian/workspace.json` 가 staged 에 **없어야** 함. 만약 있으면 `.gitignore` 가 적용 안 된 것 → 진단 필요.

이어서:
```powershell
git -C C:\claude\vault commit -m "chore: initial vault import"
```
Expected: 기존 `.obsidian/*.json` (workspace.json 제외) + `개인/lincoln-brief/2026-05-19 세션 ... .md` 등이 한 commit 에 들어감.

- [ ] **Step 5: 로그 검증**

Run:
```powershell
git -C C:\claude\vault log --oneline
```
Expected: 두 commit (`chore: initial vault import`, `chore: add .gitignore for Obsidian vault`) 표시.

---

## Task 3: `01-product-snapshot.md` 작성 + commit

**Files:**
- Create: `C:\claude\vault\개인\lincoln-brief\01-product-snapshot.md`

- [ ] **Step 1: 파일 작성**

Write to `C:\claude\vault\개인\lincoln-brief\01-product-snapshot.md`:

````markdown
---
date: 2026-05-19
last-updated: 2026-05-19
project: lincoln-brief
type: pm-deliverable
tags: [pm, lincoln-brief, product-snapshot]
---

# Lincoln Brief — Product Snapshot

## 한 줄 정의

매일 아침 미국·한국 증시 핵심을 4 에디션으로 묶어 발행하는 한국어 마켓 브리프 — 자동 수집된 시세 위에 사람이 분석을 얹는 반자동 출판물.

## 타깃 독자

- 한국 시장 + 미국 시장을 둘 다 트래킹해야 하는 개인 투자자.
- 출근 전 06:00 KST 에 그날의 시장을 한 눈에 보고 싶은 사람.
- "어떤 종목을 사세요" 같은 권유가 아니라 "관찰 가치 있음 / 분할 매수 영역" 정도의 절제된 톤을 선호하는 독자.

## 운영 방식 — 4 에디션

| 슬러그 | 이름 | 다루는 것 |
|---|---|---|
| `daily-brief` | 데일리 시황 | 당일 한·미 증시 핵심 요약 (코스피·나스닥·환율·금리) |
| `stock-analysis` | 종목 분석 | 관심 종목 펀더멘털·기술 분석 (NVDA·삼성·SK하이닉스 등) |
| `market-forecast` | 시장 예측 | 거시·섹터 기반 단·중기 전망 (Fed·BOK·섹터 로테이션) |
| `economy-issue` | 경제 이슈 | 금리·환율·정책·지정학 이벤트 (트럼프-시진핑·이란 유가 등) |

각 카드에는 마켓 배지(🇰🇷 KR / 🇺🇸 US / 🌐 GLOBAL)가 붙어 어느 시장 글인지 즉시 구분 가능.

## 자동화 파이프라인

GitHub Actions cron 세 개가 외부에서 repo 를 돌린다.

| Workflow | 주기 | 동작 | 커밋 주체 |
|---|---|---|---|
| `.github/workflows/refresh-market.yml` | **10분마다** | `npm run fetch:market` → `src/data/market-snapshot.json` 변경 시만 commit | Lincoln Brief Bot |
| `.github/workflows/daily-brief.yml` (US) | **평일 06:00 KST** (일~목 21:00 UTC) | `MARKET=US npm run generate:daily-brief` → 4 카테고리 초안 + 썸네일 4개 commit | Lincoln Brief Bot |
| `.github/workflows/kr-daily-brief.yml` (KR) | **평일 16:00 KST** (월~금 07:00 UTC) | `MARKET=KR npm run generate:daily-brief` → 4 카테고리 초안 (`kr-*` 접두) + 썸네일 4개 commit | Lincoln Brief Bot |

생성된 draft 에는 `[TODO: Lincoln 검토]` 마커가 박혀 있고, Lincoln 이 분석 섹션을 채운 뒤 마커를 제거해야 발행된다. **자동화는 사실(가격표·썸네일 골격)만 책임지고, 통찰은 사람이 채운다.** 이 경계가 무너지면 안 됨.

**자동-featured 메커니즘:** 홈 (`src/pages/index.astro`) 이 `[TODO: Lincoln 검토]` 마커가 남아있는 글을 featured 슬롯에서 자동 제외. 마커를 지우는 순간 그 글이 자동으로 메인 노출 후보로 올라옴. 따로 frontmatter `featured: true` 플래그 안 쓴다.

## 작성 흐름 — 3가지 방식 공존

세 방식 모두 같은 `src/content/blog/*.md` 파일을 만들거나 수정한다 (섞어 쓰기 안전).

1. **Keystatic UI** (`/keystatic`) — 노션식 GUI 어드민. 신규 글·수정·삭제·이미지 업로드. 저장 = `Update blog/<slug>` 형식의 git commit 자동 생성.
2. **직접 .md 편집** — VS Code 등에서 파일 직접 열어 수정 → `git push` → Vercel 자동 재배포.
3. **자동화 스크립트** — `npm run generate:daily-brief` (위 cron 들이 호출).

기존 글이 건드려지는 건 의식적으로 그 글을 열어서 수정·삭제 누를 때뿐 — Keystatic 에서 "신규 글" 만 만드는 일상 사용은 안전함.

## 현재 지표 (2026-05-19 기준)

- 게시물 총 **28편** (2026-05-14~19, 6일치)
- KR 16편 + US/GLOBAL 12편
- 4 에디션 모두 콘텐츠 있음 (홈 4-테마 스크롤 락 섹션 풀세트)
- 구독 시스템: Stibee 폼 URL 미설정 → "준비 중" 박스 노출
- RSS, Pagefind 검색, 다크모드 지원, Keystatic 어드민 활성

## 기술 스택 (PM 차원에서 알아두면 좋은 수준)

- **Astro 4.16** (hybrid output) + Tailwind 3.4 + `@astrojs/mdx` 3.x + Pagefind
- **React 18** + **Keystatic 0.5** — `/keystatic` 어드민 페이지 SSR 함수로만 실행 (나머지 페이지는 정적)
- **`@astrojs/vercel@7`** serverless adapter — Node 20 까지만 지원. `package.json` 의 `engines.node = "20.x"` 가 Vercel 빌드 환경을 Node 20 으로 고정.
- 호스팅: **Vercel** (push → 자동 빌드 → 배포). 빌드 산출물은 `.vercel/output/static/` 으로 떨어지고 pagefind 도 그쪽을 인덱싱.
- 데이터 소스: Yahoo Finance + (옵션) DART/KRX MCP — 키 누락 시 Yahoo 만으로 fallback
- 자동화: GitHub Actions, Node 22 환경 (CI 만 Node 22 가 보장됨). 로컬은 Node 20.

## 핵심 차별점

1. **반자동 출판** — 자동화가 사실을 모으고 사람이 통찰을 얹는 분업.
2. **KR + US 동시 커버** — 대부분의 한국 증시 블로그가 한 쪽만 다루는데 양쪽을 같은 톤으로 묶음.
3. **저자 톤** — "관찰 가치 있음 / 분할 매수 영역" 같은 절제된 표현 일관. 매수 추천 금지.
4. **이중 출처 원칙** — 모든 수치/뉴스에 최소 두 개의 source URL 을 frontmatter 에 박는다 (STYLE.md 의 규칙).

## "무엇이 아님"

- 증권 추천 서비스가 아님. 매수/매도 권유 안 함.
- 실시간 트레이딩 시그널 서비스가 아님. 06:00 KST 일일 한 번 + 10분 단위 시세 스냅샷이 최대 빈도.
- 종목 픽 알람·푸시 서비스가 아님 (지금은 RSS 만).

## 관련 문서

- [[02-roadmap]] — 어디로 가고 있는가
- [[03-backlog-and-open-decisions]] — 지금 열려있는 결정들
- [[04-risk-register]] — 운영 리스크 목록
- [[2026-05-19 세션 — 유료화 아이디어 · 스크롤 락 수정 · 마켓 배지]] — 5/19 작업 세션 로그
````

- [ ] **Step 2: 파일 존재 확인**

Run:
```powershell
Test-Path "C:\claude\vault\개인\lincoln-brief\01-product-snapshot.md"
```
Expected: `True`.

- [ ] **Step 3: commit**

Run:
```powershell
git -C C:\claude\vault add "개인/lincoln-brief/01-product-snapshot.md"
git -C C:\claude\vault commit -m "docs(pm): add product snapshot for lincoln-brief"
```
Expected: 1 file changed, 새 commit.

---

## Task 4: `02-roadmap.md` 작성 + commit

**Files:**
- Create: `C:\claude\vault\개인\lincoln-brief\02-roadmap.md`

- [ ] **Step 1: 파일 작성**

Write to `C:\claude\vault\개인\lincoln-brief\02-roadmap.md`:

````markdown
---
date: 2026-05-19
last-updated: 2026-05-19
project: lincoln-brief
type: pm-deliverable
tags: [pm, lincoln-brief, roadmap]
---

# Lincoln Brief — Roadmap

> 자세한 결정/액션은 [[03-backlog-and-open-decisions]] 에. 이 문서는 어디로 가고 있는지를 시간 축으로 묶는다.

## Now (0~1개월) — 결정과 안정화

핵심 키워드: **수익화 방향 선택, 뉴스레터 활성, 콘텐츠 자동 검수 강화**

- [ ] **유료화 방향 결정** — a/b/c 중 택1 (자세한 옵션은 [[03-backlog-and-open-decisions]]). 결정 안 하면 다음 단계 전부 막힘.
- [ ] **Stibee 구독 URL 채우기** — `src/consts.ts` 의 `STIBEE.SUBSCRIBE_URL` 빈 문자열 → 실제 URL. 채우면 홈 "준비 중" 박스가 바로 구독 폼으로 전환.
- [ ] **GLOBAL 마켓 배지 자동 추정 정확도 검증** — 트럼프-시진핑/이란 유가 글 등 5/14 이후 게시물의 자동 분류 결과를 페이지에서 한 차례 점검. 어긋난 글은 frontmatter `market: GLOBAL` 명시.
- [ ] **Astro 6 + Tailwind 4 마이그레이션 검토 (Node 22 설치 후)** — 워크스페이스 표준이 Astro 6 이지만 Node 20 라 폴백 중. 단순 `npx @astrojs/upgrade` 가 아니라 **`@astrojs/vercel` 도 8.x+ 로 같이 올려야** 함 (현재 7 은 Node 20 까지). React 18 → 19 호환·Keystatic 0.5 → 최신 호환도 함께 점검. 미루어도 사이트 동작에는 지장 없음 — 가속 페달 아님.

## Next (1~3개월) — 수익화 빌드아웃

선택된 유료화 방향에 따라 갈라진다.

### 방향 (a) — 유료 뉴스레터 우선

- Stibee/Maily 위에 무료 vs 유료 분리. 무료: 기본 시황. 유료: 종목 심층 분석·매수 시점 코멘트.
- 홈에 "유료 구독 혜택" 섹션 추가. 결제 페이지는 Stibee/Maily 가 호스팅.
- 사이트 코드 변경 거의 없음 → 가장 빠른 길.

### 방향 (b) — 제휴 링크 깔고 트래픽 빌드

- 키움·토스증권·미래에셋 제휴 신청. 종목 분석 글 하단에 "이 종목 매매하려면 → [제휴 링크]" 박스.
- CPA 가 광고 대비 10~50배 단가 (한국 금융 콘텐츠 특성).
- 사이트 변경: 새 컴포넌트 `<AffiliateBox />` + 글 frontmatter 에 추천 증권사 매핑.

### 방향 (c) — 자체 멤버십 풀스택

- React + Spring Boot + 결제 PG (토스페이먼츠/포트원). 기존 Astro 사이트와 별도 멤버십 앱.
- 가장 통제력 높고 데이터 자기 손에. 구축 비용 가장 큼.
- 1년 차 이후 트래픽 확보된 후 옵션. **지금은 보류 추천.**

## Later (3~6개월) — 옵션

- **자체 결제 도입** — (a) 또는 (b) 가 1차 검증된 후 (c) 로 흡수.
- **B2B 라이센싱** — 증권사 앱·핀테크 앱 안에 Lincoln Brief 위젯 제공 (RSS API 기반).
- **콘텐츠 큐레이션 자동화 강화** — `[TODO: Lincoln 검토]` 마커를 LLM-assisted 1차 초안으로 보강 (단, 최종 책임은 여전히 사람).
- **다국어** — 영문판 분리. 자동화 파이프라인 재사용 가능, 콘텐츠 톤만 갈아끼움.

## 명시적으로 빼는 것

- 실시간 알람·푸시 — 일일 1회 + 10분 시세 스냅샷이 의도된 빈도. 더 빠르게 가는 건 정체성 훼손.
- 종목 매수/매도 시그널 서비스 — 매수 추천 금지 원칙 ([[01-product-snapshot]] 참고).
- 외부 KOL/필진 참여 — 단일 저자 톤이 차별점. 최소 6개월 이후에나 검토.

## 관련 문서

- [[01-product-snapshot]] — 지금 무엇인가
- [[03-backlog-and-open-decisions]] — 다음 결정들
- [[04-risk-register]] — 길 막을 수 있는 리스크들
````

- [ ] **Step 2: commit**

Run:
```powershell
git -C C:\claude\vault add "개인/lincoln-brief/02-roadmap.md"
git -C C:\claude\vault commit -m "docs(pm): add roadmap for lincoln-brief"
```
Expected: 1 file changed, 새 commit.

---

## Task 5: `03-backlog-and-open-decisions.md` 작성 + commit

**Files:**
- Create: `C:\claude\vault\개인\lincoln-brief\03-backlog-and-open-decisions.md`

- [ ] **Step 1: 파일 작성**

Write to `C:\claude\vault\개인\lincoln-brief\03-backlog-and-open-decisions.md`:

````markdown
---
date: 2026-05-19
last-updated: 2026-05-19
project: lincoln-brief
type: pm-deliverable
tags: [pm, lincoln-brief, backlog, decisions]
---

# Lincoln Brief — Backlog & 열린 결정

> 로드맵 시간 축은 [[02-roadmap]]. 이 문서는 "지금 누가 뭘 결정해야 다음으로 갈 수 있는가" 의 액션 리스트.

## 🔴 열린 결정 (블로커)

### D1. 유료화 방향 — a/b/c 중 택1

- **결정 주체:** Lincoln
- **마감 대안:** 2026-06-19 (한 달 안에 결정 권장. 미결정 시 [[02-roadmap]] Next 단계 전부 정지)
- **옵션:**
  - (a) **유료 뉴스레터 우선** — Stibee/Maily 위 무료/유료 분리. 가장 빠름.
  - (b) **제휴 링크 깔고 트래픽 빌드** — 키움/토스/미래에셋 CPA. 사이트 변경 작음.
  - (c) **자체 멤버십 풀스택** — React + Spring Boot. 통제력 높지만 구축 큼. 1년 차 이후 권장.
- **5/19 세션의 1차 토론:** [[2026-05-19 세션 — 유료화 아이디어 · 스크롤 락 수정 · 마켓 배지]]

### D2. GitHub 원격 repo 이름 (옵시디언 sync 용)

- **결정 주체:** Lincoln
- **기본 제안:** `obsidian-vault`
- **대안:** `claude-vault`, `lincoln-notes`, `personal-vault` 등.
- **필요 시점:** 이번 옵시디언 sync 셋업 단계 (실행 계획의 Task 9).

### D3. Stibee URL 활성 시점

- **결정 주체:** Lincoln
- **조건:** D1 결정에 종속. 방향 (a) 면 즉시, 방향 (b) 면 후순위, 방향 (c) 면 미설정 유지.

## 🟡 다음 액션 (결정 안 해도 진행 가능)

- [ ] **GLOBAL 마켓 배지 자동 추정 정확도 검증** — `kr-trump-xi-korea-20260514`, `oil-iran-inflation-20260516`, `trump-xi-beijing-20260514` 등 GLOBAL 후보 게시물이 실제로 🌐 GLOBAL 라벨로 표시되는지 페이지에서 확인. 어긋난 글은 frontmatter `market: GLOBAL` 명시.
- [ ] **press02 (네이버 블로그) 톤 샘플 정리** — `WebFetch` 가 `naver.com` 차단이라 직접 가져오기 불가. 참고하고 싶은 글의 발췌를 vault 안 `참고/press02/` 에 수동 기록해두면 향후 작업에 재사용 가능.
- [ ] **5/19 세션 PR (`claude/strange-jang-c5702a` worktree) main 머지** — [[2026-05-19 세션 — 유료화 아이디어 · 스크롤 락 수정 · 마켓 배지]] 의 마지막 항목.
- [ ] **About 페이지 채우기** — `src/pages/about.astro` 존재 확인. 비어있으면 한 줄 정의 + 면책 + 연락처.
- [ ] **자동 추정 헬퍼 `src/lib/market.ts` 의 키워드 누락 케이스 정리** — 새 종목 등장 시 키워드 추가 (예: 현대차, LG에너지솔루션, 셀트리온 등 — 현재 룰에 없음).
- [ ] **Keystatic 환경변수 다른 PC 동기화 절차** — `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET` 셋은 Vercel 에 이미 들어있지만, 다른 PC 에서 `npm run dev` 로 로컬 `/keystatic` 까지 돌리려면 같은 값을 그 PC `.env` 에 복사 필요. **`.env` 는 절대 vault/repo 에 commit 금지** — 별도 비밀 저장소(1Password 등)로 전달.

## 🟢 백로그 (장기, 우선순위 낮음)

- [ ] **다크모드 토글 위치 개선** — 현재 발견하기 어려움 (사용자 피드백 들어오면 우선순위 ↑).
- [ ] **이미지 자동 최적화 점검** — `astro:assets` 활성 여부 + Vercel 측 이미지 캐시 동작 확인.
- [ ] **푸터 면책 조항 풍부화** — 현재 "투자 권유 아님, 모든 책임은 본인" 한 줄. 좀 더 구체적인 법적 어법 검토.
- [ ] **검색 결과 페이지 디자인 개선** — Pagefind 기본 UI → 사이트 톤에 맞춤.

## ⏸️ 보류

- **자체 멤버십 풀스택 (옵션 c)** — 트래픽 확보 후 1년 차 이후 재검토.
- **다국어 영문판** — 한국어판 안정화 + 수익화 검증 후.
- **Astro 6 / Tailwind 4 마이그레이션** — Node 22 설치되어야 안전. 보류.

## 관련 문서

- [[01-product-snapshot]] — 현재 무엇인가
- [[02-roadmap]] — 어디로 가는가
- [[04-risk-register]] — 위 결정들이 흔들 수 있는 리스크들
````

- [ ] **Step 2: commit**

Run:
```powershell
git -C C:\claude\vault add "개인/lincoln-brief/03-backlog-and-open-decisions.md"
git -C C:\claude\vault commit -m "docs(pm): add backlog and open decisions for lincoln-brief"
```
Expected: 1 file changed, 새 commit.

---

## Task 6: `04-risk-register.md` 작성 + commit

**Files:**
- Create: `C:\claude\vault\개인\lincoln-brief\04-risk-register.md`

- [ ] **Step 1: 파일 작성**

Write to `C:\claude\vault\개인\lincoln-brief\04-risk-register.md`:

````markdown
---
date: 2026-05-19
last-updated: 2026-05-19
project: lincoln-brief
type: pm-deliverable
tags: [pm, lincoln-brief, risk]
---

# Lincoln Brief — Risk Register

> 운영 중 발생 가능한 리스크 목록. 각 항목: **증상 / 영향도 / 완화책 / 발견 신호**.

## R1. DART/KRX API 키 누락 → 한국 데이터 빈약

- **증상:** `korea-stock-mcp` 가 환경변수 `DART_API_KEY` / `KRX_API_KEY` 부재로 fallback 동작. Yahoo `^KS11` / `^KQ11` 의 지수 종가만 잡고 외국인 수급·거래대금·공시는 못 가져옴.
- **영향도:** **중간.** KR 글의 깊이가 떨어짐. 데일리 시황은 굴러가지만 시장 예측·종목 분석 글에 디테일 부족.
- **완화책:**
  - 키는 `.env` 에 보관, repo 에 절대 push 금지 (`.gitignore` 에 `.env` 포함 확인).
  - 신규 PC 에서는 [[01-product-snapshot]] 의 "기술 스택" 항목 보고 두 키를 다시 발급받아 `.env` 작성.
  - 자동화에서 키 누락 감지 시 PR/issue 코멘트로 명시적 경고 (현재는 silent fallback — TODO).
- **발견 신호:** KR 글이 갑자기 텍스트만 길고 숫자가 적음 / 외국인 매매 데이터 비어있음.

## R2. `naver.com` WebFetch 차단 → 참고 블로그 직접 fetch 불가

- **증상:** Claude Code 의 `WebFetch` 가 `naver.com` 도메인을 막아서 `https://blog.naver.com/press02` 의 글을 직접 가져올 수 없음.
- **영향도:** **낮음~중간.** "press02 톤" 같은 작업이 요청될 때만 문제.
- **완화책:**
  - 참고 글은 사용자가 수동 발췌 → vault `참고/press02/` 에 저장 (자동화 불가).
  - 또는 메모리에 톤 가이드라인 저장해두고 발췌 없이 진행.
- **발견 신호:** "press02 스타일로 써줘" 요청에서 출처 fetch 실패.

## R3. 썸네일 base64 인라인 누락 → 프로덕션에서 사진 사라짐

- **증상:** `public/thumbnails/*.svg` 가 `<image href="/thumbnails/photos/...">` 로 외부 photo 를 참조한 채 commit 되면, 브라우저가 SVG-as-image 샌드박스 때문에 외부 리소스 로드를 막아 photo 가 안 보임.
- **영향도:** **높음.** 발행된 글의 썸네일이 깨져 보임 → 신뢰도 직격탄.
- **완화책:**
  - 썸네일 작성/수정 후 반드시 `npm run inline:thumbnails` 실행. idempotent 라 여러 번 해도 안전.
  - 신규 photo 는 `public/thumbnails/photos/_ATTRIBUTION.md` 에 출처/라이센스 기록.
  - 자동화에서 SVG 에 `href="/thumbnails/photos/"` 가 남은 채 commit 되면 lint fail 시키기 (현재 미구현 — TODO).
- **발견 신호:** Vercel 배포 후 홈에서 썸네일 배경이 흰색/투명.

## R4. Node 버전 불일치 (로컬 20 vs CI 22 vs 워크스페이스 표준 22)

- **증상:** 로컬에서 Astro 6 명령 (`fontProviders`, `glob` loader 등) 실행 시 syntax error 또는 module not found.
- **영향도:** **낮음.** 현재 프로젝트는 Astro 4 폴백 상태로 Node 20 에서 동작. CI 는 Node 22 라 빌드도 통과.
- **완화책:**
  - Astro 6 마이그레이션은 Node 22 설치 확인 (`node --version`) 후에만.
  - 다른 PC 에서 작업 시 같은 Node 버전 (20 또는 22 통일) 권장.
- **발견 신호:** `npm install` 또는 `npm run build` 에서 unexpected ES module error.

## R5. cron 실패 → 콘텐츠 공백

- **증상:** GitHub Actions cron 세 개 (`refresh-market`, `daily-brief`(US), `kr-daily-brief`(KR)) 중 하나가 권한 만료/quota 초과/API 다운으로 fail. snapshot 이 멈추거나 그날 draft 가 안 생성됨.
- **영향도:** **중간.** snapshot 멈춤 = 홈 마켓 카드가 옛 데이터 표시. daily-brief 멈춤 = 그 날·그 마켓 글 없음 (US 만 빠질 수도, KR 만 빠질 수도).
- **완화책:**
  - GitHub Actions 알림 (이메일/Slack) 활성화.
  - 매일 06:30 KST / 16:30 KST 두 시점에 홈 한 번 확인 (사람 루틴).
  - 자동화 실패가 잦으면 fallback 으로 수동 `npm run fetch:market` + `MARKET=US npm run generate:daily-brief` (또는 `MARKET=KR`) 후 commit.
- **발견 신호:** 홈에 어제 날짜 그대로 / 그 날짜의 US 또는 KR 카테고리 글 부재.

## R6. Stibee/Maily 외부 의존 (방향 a/b 선택 시)

- **증상:** Stibee/Maily 서비스 중단·가격 정책 변경·계정 정지 시 구독자 데이터 묶임.
- **영향도:** **중간.** 즉시 운영 중단되진 않지만 마이그레이션 비용 큼.
- **완화책:**
  - Stibee 의 구독자 export 기능 정기적으로 백업 (월 1회 수동).
  - 약관·가격 변경 알림 메일 무시 안 함.
  - 장기적으로 자체 멤버십 ([[02-roadmap]] Later) 으로 흡수 고려.
- **발견 신호:** Stibee 서비스 공지·요금제 변경 메일.

## R7. 자동 추정 마켓 배지 오분류 → 카드에 잘못된 국기

- **증상:** `src/lib/market.ts` 의 자동 추정이 키워드 매칭 기반이라 새 종목/이벤트가 등장하면 잘못 분류. 신규 한국 종목 키워드 누락 시 default `US` 로 떨어짐.
- **영향도:** **낮음.** 글 한 편의 배지가 어긋날 뿐 콘텐츠 자체엔 문제 없음.
- **완화책:**
  - 어긋난 글은 frontmatter `market: KR` 또는 `market: GLOBAL` 명시로 1줄 수정.
  - 자주 등장하는 신규 키워드는 `src/lib/market.ts` 룰에 추가.
  - [[03-backlog-and-open-decisions]] 의 D2 액션 — GLOBAL 추정 정확도 한 번 검증.
- **발견 신호:** 홈 4 섹션에서 한국 종목 카드에 🇺🇸 가 붙는 경우.

## R8. 옵시디언 동시 편집 충돌 (sync 도입 후)

- **증상:** 두 PC 에서 동시에 같은 노트 편집 → `git push` 시 충돌. 옵시디언 워크스페이스 상태(`.obsidian/workspace.json`)는 이미 `.gitignore` 라 안전하지만 콘텐츠 노트가 충돌 가능.
- **영향도:** **낮음.** 머지 해결 한 번이면 됨.
- **완화책:**
  - 작업 전 `git pull` 습관.
  - 두 PC 동시 작업 자제 (한 번에 한 PC).
  - 충돌 시 옵시디언 내 노트 양쪽 보기로 합치기.
- **발견 신호:** `git push` 가 "rejected (non-fast-forward)" 로 거부됨.

## R9. Keystatic 환경변수 누락 → 다른 PC 에서 어드민 다운

- **증상:** 새 PC 에서 `npm run dev` 로 `/keystatic` 진입 시 `KEYSTATIC_GITHUB_CLIENT_ID` / `KEYSTATIC_GITHUB_CLIENT_SECRET` / `KEYSTATIC_SECRET` 부재로 OAuth 실패 → 어드민 사용 불가.
- **영향도:** **낮음.** Vercel 프로덕션은 이미 환경변수 들어가 있어 영향 없음. 로컬 어드민만 쓰는 사람의 불편.
- **완화책:**
  - 세 env 값은 별도 비밀 저장소(1Password / Bitwarden 등) 에 보관. **vault / lincoln-brief repo 어디에도 절대 push 금지.**
  - 새 PC 셋업 체크리스트에 ".env 세팅" 항목 박제 (lincoln-brief 의 README 또는 CLAUDE.md 참고).
- **발견 신호:** 로컬 `/keystatic` 접속 시 OAuth 콜백 에러 또는 빈 페이지.

## R10. 세 가지 작성 방식 동시 사용 시 충돌

- **증상:** Keystatic UI 에서 글 수정하는 동안 다른 PC 에서 같은 글 직접 .md 편집 → 두 PC 모두 push 하면 conflict. 또는 자동화 cron 이 같은 슬러그로 새 글 생성 시도 (이건 `fs.access` 가드로 skip 되니 안전).
- **영향도:** **낮음~중간.** Keystatic UI + 직접 편집을 같은 글에 동시 적용할 때만 위험.
- **완화책:**
  - 한 글은 한 경로로만 — Keystatic UI 로 만든 글은 UI 에서만 수정, 자동화 생성 글은 직접 .md 로만 수정.
  - 작업 전 `git pull` 습관.
  - cron 의 같은-슬러그-skip 동작은 보존 — 손댄 글이 자동화에 덮어쓰여지지 않음.
- **발견 신호:** `git push` rejected / Keystatic UI 가 "외부에서 변경되었습니다" 같은 에러 표시.

## 관련 문서

- [[01-product-snapshot]] — 시스템 전체 그림
- [[02-roadmap]] — 다음에 뭘 할 것인가
- [[03-backlog-and-open-decisions]] — 지금 결정해야 할 것
````

- [ ] **Step 2: commit**

Run:
```powershell
git -C C:\claude\vault add "개인/lincoln-brief/04-risk-register.md"
git -C C:\claude\vault commit -m "docs(pm): add risk register for lincoln-brief"
```
Expected: 1 file changed, 새 commit.

---

## Task 7: `README.md` 작성 + commit (다른 PC 부트스트랩 안내)

**Files:**
- Create: `C:\claude\vault\README.md`

- [ ] **Step 1: 파일 작성**

Write to `C:\claude\vault\README.md`:

````markdown
# Personal Obsidian Vault

옵시디언 볼트 — 개인 노트 + 프로젝트 PM 산출물 + 세션 로그. 여러 PC 에서 동일하게 쓰기 위해 git 으로 동기화.

## 다른 PC 셋업

```powershell
# 1) 옵시디언 설치 — https://obsidian.md/ 또는 포터블 버전
# 2) 볼트 클론
git clone <this-repo-url> C:\claude\vault
# 3) 옵시디언 실행 → "Open folder as vault" → C:\claude\vault 선택
```

## 일상 동기화 — 수동

```powershell
cd C:\claude\vault
git pull                       # 작업 시작 시 항상 먼저
# ... 옵시디언에서 노트 편집 ...
git add -A
git commit -m "vault: <설명>"
git push
```

옵시디언 Git 플러그인으로 자동화도 가능하지만 이번 셋업에서는 도입 안 함 (이중 자동화 충돌 방지).

## 주의

- **민감 정보 (API 키, 토큰, 비밀번호) 절대 push 금지.** private repo 라도 노출 위험.
- `.obsidian/workspace.json` 등 PC-local 상태 파일은 `.gitignore` 로 제외됨 — staged 에서 빠져 있는 게 정상.
- 두 PC 에서 동시 편집 시 `git push` 충돌 가능. 작업 전 `git pull` 권장.

## 폴더 구조

- `개인/` — 개인 프로젝트 노트.
  - `lincoln-brief/` — Lincoln Brief 프로젝트 PM 산출물 (`01-product-snapshot.md`, `02-roadmap.md`, `03-backlog-and-open-decisions.md`, `04-risk-register.md`) + 세션 로그.
- (이후 다른 프로젝트 폴더 추가 가능)
````

- [ ] **Step 2: commit**

Run:
```powershell
git -C C:\claude\vault add README.md
git -C C:\claude\vault commit -m "docs: add vault README with sync instructions"
```
Expected: 1 file changed, 새 commit.

---

## Task 8: 옵시디언에서 PM 4 문서 렌더 검증 (사용자 수동 단계)

**Files:** none (read-only verification)

- [ ] **Step 1: 사용자에게 옵시디언 실행 안내**

> "포터블 옵시디언(`C:\claude\utils\Obsidian\Obsidian.exe`)을 실행하고 `C:\claude\vault` 를 vault 로 여세요."

- [ ] **Step 2: 4 문서 렌더링 확인 항목 안내**

사용자가 옵시디언에서 확인할 4 가지:

1. `개인/lincoln-brief/` 폴더 안에 4 개 .md 파일이 보인다.
2. 각 파일을 열어 frontmatter (date, tags 등) 가 옵시디언 properties 패널에 잘 잡힌다.
3. 본문에 들어간 `[[01-product-snapshot]]` 같은 internal link 를 클릭하면 해당 문서로 이동한다.
4. `[[2026-05-19 세션 — 유료화 아이디어 · 스크롤 락 수정 · 마켓 배지]]` 링크도 기존 노트로 연결된다 (백링크 패널에서도 확인 가능).

- [ ] **Step 3: 사용자 컨펌 대기**

사용자가 "OK / 다 보임" 또는 "X 문제 있음" 이라고 응답할 때까지 대기. 문제가 있으면 해당 문서 인라인 수정 후 commit, 재확인.

---

## Task 9: GitHub 원격 repo 이름 사용자 확인

**Files:** none

- [ ] **Step 1: 사용자에게 repo 이름 묻기**

```text
GitHub private repo 이름을 정해주세요.
- 기본 제안: obsidian-vault
- 대안: claude-vault, lincoln-notes, personal-vault 등
- 본인이 다른 이름 원하시면 자유롭게.
```

`AskUserQuestion` 또는 텍스트 질문으로 1회 컨펌. 응답 받기 전엔 Task 10 진행 금지.

---

## Task 10: GitHub private repo 생성 + push

**Files:** none (remote operations)

- [ ] **Step 1: gh 인증 재확인**

Run:
```powershell
gh auth status
```
Expected: `Logged in to github.com account <username>`. 인증 끊겼으면 `gh auth login` 안내.

- [ ] **Step 2: repo 생성 + remote 등록 + push 한 번에**

`<NAME>` 자리에 Task 9 에서 받은 이름을 넣어 실행:

```powershell
gh repo create <NAME> --private --source=C:\claude\vault --remote=origin --push
```

Expected:
- `✓ Created repository <user>/<NAME> on github.com`
- `✓ Added remote https://github.com/<user>/<NAME>.git`
- `✓ Pushed commits to https://github.com/<user>/<NAME>.git`

만약 같은 이름의 repo 가 이미 있어 에러나면 Task 9 로 돌아가 다른 이름 받기.

- [ ] **Step 3: remote 확인**

Run:
```powershell
git -C C:\claude\vault remote -v
git -C C:\claude\vault branch -vv
```
Expected:
- remote `origin` 이 `https://github.com/<user>/<NAME>.git` 로 양방향 등록됨
- main 브랜치가 `origin/main` 추적

---

## Task 11: 최종 검증

**Files:** none (read-only verification)

- [ ] **Step 1: 로컬 git 상태 클린**

Run:
```powershell
git -C C:\claude\vault status
```
Expected: `nothing to commit, working tree clean`. 만약 dirty 면 (예: 작업 중 옵시디언 워크스페이스 변경) 진단 후 정리.

- [ ] **Step 2: commit 히스토리 검증**

Run:
```powershell
git -C C:\claude\vault log --oneline
```
Expected: 다음 commit 들이 시간 역순으로 보임 (혹은 일부 순서 차이):
- `docs: add vault README with sync instructions`
- `docs(pm): add risk register for lincoln-brief`
- `docs(pm): add backlog and open decisions for lincoln-brief`
- `docs(pm): add roadmap for lincoln-brief`
- `docs(pm): add product snapshot for lincoln-brief`
- `chore: initial vault import`
- `chore: add .gitignore for Obsidian vault`

총 7 개 commit.

- [ ] **Step 3: 원격 동기화 검증**

Run:
```powershell
git -C C:\claude\vault ls-remote origin
```
Expected: `refs/heads/main` 라인이 보이고, 해당 sha 가 `git -C C:\claude\vault rev-parse HEAD` 와 일치.

- [ ] **Step 4: `.gitignore` 적용 검증**

Run:
```powershell
git -C C:\claude\vault check-ignore -v .obsidian/workspace.json
```
Expected: `.gitignore:2:.obsidian/workspace.json    .obsidian/workspace.json` 같은 형태로 매칭 라인 표시 (=ignore 적용 중).

- [ ] **Step 5: 사용자에게 다른 PC 부트스트랩 안내**

> "셋업 끝. 다른 PC 에서는 `git clone https://github.com/<user>/<NAME>.git C:\claude\vault` 후 옵시디언으로 폴더 열면 동일하게 사용 가능. 자세한 동기화 절차는 vault 의 README.md 참고."

---

## 완료 후 산출물 요약

- vault 가 GitHub private repo 와 연결됨 — 다른 PC 에서 `git clone` 가능.
- `개인/lincoln-brief/` 안에 PM 산출물 4 종 + 기존 5/19 세션 노트.
- `.gitignore` 로 PC-local 상태/비밀 파일 제외.
- `README.md` 로 다른 PC 부트스트랩 + 일상 sync 절차 박제.
- lincoln-brief 코드 변경 없음.

## 후속 작업 후보 (이 플랜 밖)

- 옵시디언 Git 플러그인 도입으로 push/pull 자동화.
- vault 안에 `참고/press02/` 폴더 + 톤 샘플 수집.
- D1 (유료화 방향) 결정 → [[02-roadmap]] Next 단계 실제 실행.
