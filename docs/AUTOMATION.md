# Lincoln Brief — 자동화 아키텍처

운영 중인 GitHub Actions 워크플로 3종과 일일 발행 파이프라인의 구조.

> 트러블슈팅·매일 모니터링·유지보수 절차는 [OPERATIONS.md](OPERATIONS.md) 참고.

---

## 1. 워크플로 인벤토리

| 파일 | 이름 | 트리거 | 무슨 일 | 산출물 |
|---|---|---|---|---|
| `.github/workflows/refresh-market.yml` | Refresh market snapshot | cron `5,15,25,35,45,55 * * * *` + dispatch | yahoo-finance2 로 `src/data/market-snapshot.json` 갱신. 변화 있을 때만 커밋. | `data: refresh market snapshot (YYYY-MM-DD HH:MM KST)` 커밋 |
| `.github/workflows/daily-brief.yml` | Daily Market Brief (US, Claude Code) | cron `0 16 * * 0-4` + `0 21 * * 0-4` (= 월~금 01:00 + 06:00 KST) + dispatch | Claude Code Action 이 미국 4 카테고리 본문 + 썸네일 생성·커밋. | 글 4편 + SVG 4개, slug 접두 없음 |
| `.github/workflows/kr-daily-brief.yml` | Daily Market Brief (KR, Claude Code) | cron `0 2 * * 1-5` + `0 7 * * 1-5` (= 월~금 11:00 + 16:00 KST) + dispatch | 동일하되 KR 4 카테고리. | 글 4편 + SVG 4개, slug `kr-` 접두 |
| `.github/workflows/deploy.yml` | Build & Deploy | push to main | Astro build 검증만 (실제 배포는 Vercel GitHub 연동). | 빌드 성공/실패 |

스케줄러 지연: GitHub Actions cron 은 5~15 분 지연이 흔함. 정각 회피 위해 refresh 는 `:05/:15/...` 로 박혀있음.

---

## 2. 데이터·생성 파이프라인 (Daily Brief)

```
                  [cron US 16:00 / 21:00 UTC · KR 02:00 / 07:00 UTC]
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ daily-brief.yml  /  kr-daily-brief.yml                                  │
│                                                                          │
│  1. Checkout                                                             │
│  2. Setup Node 22                                                        │
│  3. Secrets 가드  ── CLAUDE_CODE_OAUTH_TOKEN 존재 여부 확인              │
│  4. npm install                                                          │
│  5. node scripts/fetch-market.mjs                                        │
│        └─→ Yahoo Finance + (KRX/DART, 키 있을 때) → market-snapshot.json │
│  6. git commit (snapshot 변화 시)                                        │
│  7. Load generation prompt                                               │
│        └─→ cat scripts/generation-prompt.md → step output `PROMPT`       │
│  8. anthropics/claude-code-action@v1                                     │
│        └─→ Claude Code 가 prompt 따라:                                   │
│            ├─ STYLE.md / CLAUDE.md / market-snapshot.json 읽기           │
│            ├─ 최근 같은 카테고리 글 2편 참조 (톤)                         │
│            ├─ WebFetch 로 뉴스 헤드라인 보강                             │
│            ├─ 4편 .md 작성 (frontmatter zod 스키마 준수)                │
│            ├─ 4개 SVG 썸네일 작성                                       │
│            ├─ Safety gate (금지어, 사인오프, 분량, 출처 숫자)            │
│            └─ npx astro build 로 검증                                    │
│  9. Verify build (safety net)                                            │
│ 10. git commit & push  ── `data: ${MARKET} daily brief auto-generated …` │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                  [main push] → Vercel GitHub 연동 → 자동 재배포
```

### 환경변수 / Secrets

| 이름 | 어디 | 필수 | 용도 |
|---|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | GitHub repo secret | 필수 | Claude Code Action 인증 (Pro/Max quota). [발급 가이드](https://docs.claude.com/en/docs/claude-code/github-actions) |
| `KRX_API_KEY` | repo secret | KR 데이터 깊이 ↑ | 거래대금·외국인 매매 (없으면 Yahoo 폴백) |
| `DART_API_KEY` | repo secret | 종목 분석 깊이 ↑ | 공시 데이터 (없으면 생략) |
| `MARKET` | 워크플로 step env | 워크플로 내부 고정 | `US` 또는 `KR` — `generation-prompt.md` 가 분기 사용 |

### 권한 (workflow `permissions` 블록)

`daily-brief.yml` / `kr-daily-brief.yml` 둘 다:
- `contents: write` — 생성한 .md / .svg 푸시
- `pull-requests: write` — Claude Code Action 의 PR 생성 기능
- `issues: write` — Action 의 이슈 리포트 기능
- `id-token: write` — **OIDC 인증 필수** (없으면 Action 실패. PR #19 가 추가)

---

## 3. 프롬프트 체인

| 파일 | 역할 |
|---|---|
| `scripts/generation-prompt.md` | Claude 한테 주는 메인 지시서 (96줄). 단계·산출물·안전 게이트·출력 보고 형식. |
| `STYLE.md` | 톤, 본문 구조, 금지어, frontmatter 필드 — prompt 1번 항목이 읽으라고 시킴 |
| `CLAUDE.md` | 프로젝트 컨벤션, 마켓 감지, content collection 스키마 |
| `src/data/market-snapshot.json` | 가격 데이터. prompt 가 "여기 있는 숫자만 인용 가능" 라고 못박음 |
| `src/content/blog/<recent>.md` | 동일 카테고리 최근 글 2편 — 톤 참조. **prompt 안에 슬러그 하드코딩** (현 시점 한계, 개선 후보) |
| `src/consts.ts` | `CATEGORIES` enum 단일 출처 (4개) |

### 워크플로 → Action 으로 prompt 전달

Claude Code Action **v1 은 `prompt_file` 인풋 없음** (action.yml 미정의). Step output 으로 보간:

```yaml
- name: Load generation prompt
  id: load_prompt
  run: |
    {
      echo "PROMPT<<PROMPT_EOF"
      cat scripts/generation-prompt.md
      echo "PROMPT_EOF"
    } >> "$GITHUB_OUTPUT"

- uses: anthropics/claude-code-action@v1
  with:
    prompt: ${{ steps.load_prompt.outputs.PROMPT }}
```

`generation-prompt.md` 내에 `${{ ... }}` (GHA 보간) 패턴 박지 말 것 — outputs 로 들어오면 보간이 풀리지 않음. 셸 표기 `${MARKET}` 는 안전.
