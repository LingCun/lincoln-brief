# Lincoln Brief — 배치 자동화 가이드

운영 중인 GitHub Actions 워크플로 3종과 일일 발행 파이프라인의 전체 흐름·트러블슈팅·재실행 절차.

> 단기 요약은 `CLAUDE.md` 의 "automation pipeline" 섹션 참고. 본 문서는 그 디테일판.

---

## 1. 워크플로 인벤토리

| 파일 | 이름 | 트리거 | 무슨 일 | 산출물 |
|---|---|---|---|---|
| `.github/workflows/refresh-market.yml` | Refresh market snapshot | cron `5,15,25,35,45,55 * * * *` + dispatch | yahoo-finance2 로 `src/data/market-snapshot.json` 갱신. 변화 있을 때만 커밋. | `data: refresh market snapshot (YYYY-MM-DD HH:MM KST)` 커밋 |
| `.github/workflows/daily-brief.yml` | Daily Market Brief (US, Claude Code) | cron `0 21 * * 0-4` (= 월~금 06:00 KST) + dispatch | Claude Code Action 이 미국 4 카테고리 본문 + 썸네일 생성·커밋. | 글 4편 + SVG 4개, slug 접두 없음 |
| `.github/workflows/kr-daily-brief.yml` | Daily Market Brief (KR, Claude Code) | cron `0 7 * * 1-5` (= 월~금 16:00 KST) + dispatch | 동일하되 KR 4 카테고리. | 글 4편 + SVG 4개, slug `kr-` 접두 |
| `.github/workflows/deploy.yml` | Build & Deploy | push to main | Astro build 검증만 (실제 배포는 Vercel GitHub 연동). | 빌드 성공/실패 |

스케줄러 지연: GitHub Actions cron 은 5~15 분 지연이 흔함. 정각 회피 위해 refresh 는 `:05/:15/...` 로 박혀있음.

---

## 2. 데이터·생성 파이프라인 (Daily Brief)

```
                          [cron 21:00 UTC (US) / 07:00 UTC (KR)]
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

---

## 4. 트리거 매뉴얼 실행

```powershell
# 워크플로 dispatch
gh workflow run "Daily Market Brief (US, Claude Code)" --ref main
gh workflow run "Daily Market Brief (KR, Claude Code)" --ref main

# 최근 실행 확인
gh run list --workflow="Daily Market Brief (US, Claude Code)" --limit 5

# 실시간 watch
gh run watch <RUN_ID> --exit-status

# 실패 로그
gh run view <RUN_ID> --log-failed
```

스케줄 임의 변경 (검증용): cron 줄을 잠깐 가까운 시각으로 바꿔서 push → 발화 확인 → 원복. GHA 무료 티어 지연 감안해 발화 예상 시각 +15 분까지 대기.

---

## 5. 트러블슈팅

### 증상: `Run completed: success` 인데 **글 0편 발행**
판단 기준: `git log --since="20 minutes ago" --oneline` 에 `data: ${MARKET} daily brief auto-generated for …` 커밋이 **없으면** 진짜 0편. Author 는 `claude[bot]`.

- 원인 후보 (확인 순서):
  1. Action 단계 로그에 `Unexpected input(s) 'prompt_file'` → 본 가이드 §3의 step output 방식 누락. 해결: `prompt: ${{ steps.load_prompt.outputs.PROMPT }}` 로 수정.
  2. 모든 4개 슬러그가 이미 존재 → prompt 의 "skip existing" 규칙대로 정상. 같은 날 두 번째 실행하면 흔함. Action 의 Output report 단계 메시지 확인.
  3. Safety gate 가 4편 전부 `draft: true` 처리 → 본 가이드 §3의 prompt 8번 항목 확인. draft 만 푸시되거나 git diff 비어있을 수 있음.
  4. Action 자체 실패 (네트워크·quota·OIDC) → Action step 의 stderr 로그 확인.

### 증상: Action step 자체 실패 (빨간 X)
- `CLAUDE_CODE_OAUTH_TOKEN secret 미등록` → repo Settings → Secrets and variables → Actions 에 추가
- `OIDC token request failed` → `permissions: id-token: write` 누락. PR #19 의 패치 참고.
- Quota exceeded → Pro/Max 구독 한도 도달. 다음 주기 대기 또는 quota 업그레이드.

### 증상: 푸시 됐는데 Vercel 배포 안 됨
- Vercel Dashboard → Deployments 탭에서 빌드 실패 여부 확인
- `astro build` 가 워크플로 안에서 통과했어도 Vercel 환경 (Node 20, 다른 env) 에서 실패 가능 — `engines.node = "20.x"` 핀 확인
- Keystatic 환경변수 (`KEYSTATIC_*`) 누락 시 빌드 실패 — Vercel env 확인

### 증상: 같은 슬러그가 매일 새로 만들어져서 덮어쓰기
- prompt 의 "Skip any slug that already exists" 규칙이 무시됨 → Action 의 Read/Write 권한과 `fs.access` 체크 검증
- 슬러그 패턴이 날짜 포함 (`-YYYYMMDD`) 이라 매일 다른 슬러그 — 정상

---

## 6. 운영 노트

### 매일 모니터링 포인트
1. **06:05 KST** (US 발화 +5 분): `gh run list --workflow="Daily Market Brief (US, Claude Code)" --limit 1` 상태 확인
2. **16:05 KST** (KR 발화 +5 분): 동일 (KR 워크플로)
3. 실패 시 즉시 `gh run view --log-failed`

### 정기 유지보수
- **분기 1회**: `scripts/fetch-market.mjs` 의 `KR_TOP_12` / `US_TOP_12` 시총 순서 갱신
- **카테고리 추가/삭제**: `src/consts.ts` 한 곳만 — zod 스키마·라우트·Keystatic·prompt 가 자동 반영 (단 prompt 의 4 카테고리 본문 지시는 직접 수정)
- **prompt 내 최근 글 슬러그 하드코딩**: `scripts/generation-prompt.md` 1번 항목. 동적 (최근 N편 자동 선택) 으로 리팩터 후보.

### 개선 후보 (백로그)
- prompt 내 최근 글 슬러그 하드코딩 → glob 으로 동적 선택
- Safety gate 결과를 Job summary 에 구조화 출력 (현재 자유 텍스트)
- KR_TOP_12 자동 갱신 (KRX 시총 API 활용)
- 휴장일 감지 — 휴장 KST 날짜는 워크플로 자체를 skip
