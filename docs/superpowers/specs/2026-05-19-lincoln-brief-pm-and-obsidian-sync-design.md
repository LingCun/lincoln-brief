---
date: 2026-05-19
project: lincoln-brief
type: design-spec
status: approved
tags: [spec, pm, obsidian, sync, git]
---

# Lincoln Brief — PM 산출물 + 옵시디언 Git 동기화

## 목표

1. 배포된 Lincoln Brief 사이트(<https://lincoln-brief.vercel.app/>)의 현재 상태를 PM 관점에서 정리한 4종 산출물을 옵시디언 볼트에 저장한다.
2. 옵시디언 볼트(`C:\claude\vault\`)를 GitHub private repo로 동기화해, 다른 PC에서 `git clone` 한 번으로 동일하게 사용할 수 있게 한다.

## 비목표 (Out of scope)

- Lincoln Brief 코드(Astro/스크립트) 변경 — 손대지 않는다.
- `C:\claude\` 워크스페이스 전체를 git에 올리는 것 — 볼트만 별도 repo로 분리한다.
- 포터블 옵시디언(`C:\claude\utils\Obsidian\`) 바이너리 동기화 — 다른 PC에선 옵시디언을 별도로 설치한다고 가정.
- Obsidian Git 플러그인 등 자동 동기화 셋업 — 후속 작업으로 분리한다 (이번엔 수동 `git push/pull`).
- PM 산출물 자동 갱신/cron — 모두 사람이 갱신하는 살아있는 문서로 둔다.

## 컨텍스트

### 사이트 현황 (2026-05-19 기준)

- 매일 06:00 KST 발행을 표방하는 한국어 미국·한국 증시 브리핑 블로그.
- 4 에디션: 데일리 시황 / 종목 분석 / 시장 예측 / 경제 이슈 (`src/consts.ts` 의 `CATEGORIES` 에 enum 으로 정의).
- 게시물 28편 (2026-05-14~19): KR 16편 + US/GLOBAL 12편.
- 메인 화면: 마켓 스냅샷 TOP 12 (KR/US), 4 테마 스크롤 락 섹션, Editors' Pick, Pagefind 검색, RSS.
- 자동화 파이프라인 3개 (`.github/workflows/`): `refresh-market.yml` (10분 주기), `daily-brief.yml` (US, 평일 06:00 KST = 일~목 21:00 UTC), `kr-daily-brief.yml` (KR, 평일 16:00 KST = 월~금 07:00 UTC). 모두 Lincoln Brief Bot 명의로 main 에 직접 푸시.
- CMS: Keystatic 어드민 `/keystatic` (Astro hybrid output + Vercel serverless adapter, GitHub OAuth 인증). `src/content/blog/*.md` 를 노션식 GUI 로 편집. Keystatic UI / 직접 .md / 자동화 스크립트 세 작성 경로 공존.
- Stibee 구독 URL 미설정 (`src/consts.ts` 의 `STIBEE.SUBSCRIBE_URL = ''`) → "준비 중" 박스 노출.

### 볼트 현황

- 위치: `C:\claude\vault\`.
- 기존 노트: `개인\lincoln-brief\2026-05-19 세션 — 유료화 아이디어 · 스크롤 락 수정 · 마켓 배지.md` (한 개, 유료화 a/b/c 결정 대기 상태).
- `.obsidian\app.json` 거의 비어 있음 (기본값).
- git 추적 안 됨.
- 포터블 옵시디언이 `C:\claude\utils\Obsidian\Obsidian.exe` 에 존재.

### 알려진 열린 결정 / 리스크 (메모리·세션 노트에서)

- 유료화 방향 a/b/c — 유저 선택 대기 중.
- 트럼프-시진핑 / 이란 유가 등 GLOBAL 자동 추정 정확도 미검증.
- Astro 6 + Tailwind 4 마이그레이션 보류 — Node 22 미설치 때문.
- `naver.com` WebFetch 차단 → 참고 블로그(blog.naver.com/press02) 직접 fetch 불가.

## 아키텍처

### A. PM 산출물 4종 — `C:\claude\vault\개인\lincoln-brief\`

```
vault/개인/lincoln-brief/
├─ 01-product-snapshot.md
├─ 02-roadmap.md
├─ 03-backlog-and-open-decisions.md
├─ 04-risk-register.md
└─ 2026-05-19 세션 — 유료화 아이디어 · 스크롤 락 수정 · 마켓 배지.md  (기존)
```

**공통 frontmatter:**

```yaml
---
date: 2026-05-19
last-updated: 2026-05-19
project: lincoln-brief
type: pm-deliverable
tags: [pm, lincoln-brief, <doc-type>]
---
```

**4종 문서 핵심 섹션:**

| 파일 | 핵심 섹션 |
|---|---|
| `01-product-snapshot.md` | 한 줄 정의 · 타깃 독자 · 4 에디션 운영 방식 · 자동화 파이프라인 (10분·06:00 KST cron) · 현재 지표(게시물 28편, KR 16·US-GLOBAL 12) · 핵심 차별점 · "무엇이 아님" |
| `02-roadmap.md` | Now(0~1개월): 유료화 결정 · 뉴스레터 활성 · Astro 6 검토 / Next(1~3개월): 제휴/멤버십 빌드아웃 · 검색·UX 강화 / Later(3~6개월): 자체 결제 · B2B 라이센싱 옵션 |
| `03-backlog-and-open-decisions.md` | 열린 결정(유료화 a/b/c, GLOBAL 추정 검증, Stibee URL 채우기) + 다음 액션 체크박스 + 보류 항목 |
| `04-risk-register.md` | DART/KRX API 키 누락 시 폴백 동작 · press02 fetch 차단 · thumbnail base64 누락 · Node 버전 불일치 · cron 실패 시 콘텐츠 공백 · 결제 외부 의존(Stibee) — 각 항목에 영향도/완화책 |

**문서 간 연결 원칙:**

- 4개 문서는 옵시디언 internal link(`[[01-product-snapshot]]` 형식)로 서로 참조.
- `[[2026-05-19 세션 — 유료화 아이디어 · 스크롤 락 수정 · 마켓 배지]]` 도 적절한 위치에서 백링크.
- 모든 사실(게시물 수, 자동화 동작, 알려진 이슈)은 lincoln-brief 코드/세션 노트에서 추출. 추측·발명 금지.
- buy/sell/투자 권유 문구 등은 사용하지 않는다 (사이트 STYLE.md 와 동일 톤).

### B. 옵시디언 → Git 동기화

```
C:\claude\vault\          ← git init 위치 (vault 자체가 repo 루트)
├─ .git/
├─ .gitignore             ← workspace.json / cache / trash 등 제외
├─ README.md              ← "다른 PC에서 셋업하는 법" 안내
├─ .obsidian/
│  ├─ app.json            ← 추적 (공유 설정)
│  ├─ appearance.json     ← 추적 (테마 등)
│  ├─ core-plugins.json   ← 추적
│  └─ workspace.json      ← .gitignore (탭/창 위치 등 PC-local)
├─ 개인/
│  └─ lincoln-brief/
│     ├─ 01-product-snapshot.md
│     ├─ 02-roadmap.md
│     ├─ 03-backlog-and-open-decisions.md
│     ├─ 04-risk-register.md
│     └─ 2026-05-19 세션 ... .md
└─ (기타 볼트 콘텐츠)
```

**`.gitignore` 내용:**

```
# Obsidian — PC-local 상태
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
```

**원격 저장소:**

- GitHub private repo.
- 이름은 사용자에게 확인 받은 뒤 생성한다 (기본 제안: `obsidian-vault`). repo 만들기 전에 명시적으로 1회 컨펌.
- 인증: 기존에 설정된 `gh` CLI 우선. 미인증 시 `gh auth login` 안내. `gh` 자체가 없으면 GitHub 웹에서 repo 생성 후 `git remote add origin <url>` 수동 안내.

**다른 PC 부트스트랩 (`README.md` 에 박제):**

```powershell
# 1) Obsidian 설치 (https://obsidian.md/ 또는 포터블)
# 2) 볼트 클론
git clone <repo-url> C:\claude\vault
# 3) Obsidian → "Open folder as vault" → C:\claude\vault

# 일상 동기화 (수동)
cd C:\claude\vault
git pull            # 작업 시작 시
# ... 옵시디언에서 노트 편집 ...
git add -A
git commit -m "vault update"
git push
```

## 데이터 플로우

```
[lincoln-brief 코드 + 5/19 세션 노트]
        │
        ▼
[PM 산출물 4종 .md 작성]  ←─── 사실만 추출, 추측 금지
        │
        ▼
[vault/개인/lincoln-brief/ 에 저장]
        │
        ▼
[vault 루트에서 git init + .gitignore + README]
        │
        ▼
[gh repo create --private] ──→ [GitHub private repo]
        │
        ▼
[git push -u origin main]
        │
        ▼
[다른 PC: git clone → Obsidian Open vault] ← 사용자가 직접 수행
```

## 에러 처리 & 엣지 케이스

| 상황 | 대응 |
|---|---|
| `gh` CLI 미인증 | `gh auth login` 안내 후 사용자 실행 대기. `gh` 자체가 없으면 GitHub 웹에서 repo 만들고 `git remote add origin <url>` 수동 안내. |
| 원격 repo 이름 충돌 | 사용자에게 다른 이름 제안 후 재시도. |
| `C:\claude\vault\` 안에 이미 `.git` 존재 | `git status` + `git remote -v` 로 상태 확인 후 `git init` 생략하고 진행. 기존 remote 가 있으면 그 URL 을 사용자에게 보여주고 "그대로 쓸지 / 새로 만들지" 1회 확인. |
| Obsidian Git 플러그인 충돌 | 이 디자인의 sync 는 **수동 `git push/pull`** 이다. Obsidian Git 플러그인이 만약 이미 설치되어 있으면 비활성화 권장(이중 자동화 충돌 방지). plugin **데이터** 파일은 추적하되, plugin **자동 sync 동작** 은 이번 스코프 외. |
| 민감 정보가 볼트에 들어 있는 경우 (API 키, 토큰 등) | `git add -A` 전에 본인이 grep 한 번. README 와 .gitignore 에 "민감 정보 금지" 명시. private repo 라도 안전망. |
| `.obsidian/workspace.json` 가 이미 staged 된 상태 | `.gitignore` 추가 후 `git rm --cached .obsidian/workspace.json` 로 명시 제거. |
| 두 번째 PC 에서 옵시디언 plugin 데이터 불일치 | plugin data 폴더는 추적 대상 (공유 설정이라). 충돌 시 git merge 수동 해결. |

## 검증 (이번 PC 에서 가능한 범위)

1. **PM 문서 렌더링:** `C:\claude\utils\Obsidian\Obsidian.exe` 로 vault 열어서 `01~04` 문서가 정상 렌더링되고 internal link 가 살아있는지 확인.
2. **.gitignore 동작:** `git status` 결과에 `workspace.json` 가 untracked 로 안 잡혀야 함.
3. **로컬 commit 성공:** `git log --oneline` 에 첫 commit 보임.
4. **원격 푸시 성공:** `git ls-remote origin` 로 main branch 가 원격에 올라가 있는지 확인.
5. **다른 PC 검증 (사용자가 직접):** README 단계 따라 clone → 옵시디언 open → 4 문서 보이면 OK.

테스트 자동화는 도입하지 않는다 (수동 검증으로 충분한 1회성 셋업 작업).

## 의존성·전제 조건

- `git` CLI 사용 가능 (Windows 에 이미 설치되어 있음 — 본 프로젝트 자체가 git repo). 실행 단계 시작 직전 `git --version` 으로 한 번 확인.
- `gh` CLI 인증 상태 — 미확인. 실행 전에 `gh auth status` 로 확인.
- GitHub 계정 (jeen) 존재 가정.
- `C:\claude\vault\` 외부에서 옵시디언이 동시 실행 중이지 않을 것 (commit 시 `.obsidian/workspace.json` 가 계속 변하면 staged 상태가 흔들림).

## 다음 단계

이 디자인 승인 후 → `superpowers:writing-plans` 스킬로 실행 계획 작성. 실행 계획은 다음 6 묶음을 단계별 명령·검증 포인트와 함께 구체화한다.

1. PM 산출물 4종 작성 (vault 에 .md 파일 4개 생성)
2. 옵시디언에서 4 문서 정상 렌더 검증
3. vault `.gitignore` + `README.md` 작성
4. `git init` + 첫 commit
5. GitHub private repo 생성 + push
6. 사용자가 다른 PC 에서 clone 테스트 (README 안내까지로 종료)
