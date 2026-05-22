# External Cron Setup (cron-job.org → GHA workflow_dispatch)

## 왜 이게 필요한가

GitHub Actions `schedule:` cron 은 공식 문서에 명시된 대로 "best-effort, may be delayed during high load". 실제로 이 레포에서 2026-05-22 KR 11 슬롯 cron 이 7시간 트리거 0회를 기록. `workflow_dispatch` (수동 트리거) 는 같은 시간에 정상 동작 → schedule 트리거 자체가 문제.

해결: 외부 cron 서비스 (cron-job.org 무료) 가 우리 endpoint `/api/cron/dispatch` 를 hit → endpoint 가 GitHub API `workflow_dispatch` 발사 → 기존 워크플로 그대로 동작.

기존 GHA `schedule:` cron 은 belt-and-suspenders 로 유지. 워크플로 자체에 concurrency group 이 걸려있어 중복 발사 시 자동 큐잉/스킵 → 안전.

## 셋업 (1회, ~10분)

### 1. GitHub Fine-grained PAT 발급

`https://github.com/settings/personal-access-tokens/new`

- Token name: `lincoln-brief-cron-dispatch`
- Expiration: 1 year (지나면 갱신)
- Repository access: **Only select repositories** → `LingCun/lincoln-brief`
- Repository permissions:
  - **Actions: Read and write** ← 필수
  - 나머지 전부 No access (최소권한)
- Generate token → 복사 (`github_pat_...`)

### 2. Vercel 환경변수 등록

`vercel.com/dashboard` → 프로젝트 → Settings → Environment Variables. 다음 2개 추가, Production·Preview·Development 모두 체크:

```
CRON_SECRET           = (32자+ 랜덤 문자열, openssl rand -hex 32 등으로 생성)
GH_DISPATCH_TOKEN     = (1번에서 발급한 github_pat_...)
```

**Redeploy 필수** (Vercel 환경변수는 새 배포에만 주입됨).

### 3. cron-job.org 가입 + 9개 job 생성

`https://console.cron-job.org` 가입 (무료, 이메일만).

각 job 공통 설정:
- **URL**: `https://lincoln-brief.vercel.app/api/cron/dispatch?job=<JOB_NAME>` (아래 표 참고)
- **Request method**: GET
- **Request headers**: 추가
  - Key: `Authorization`
  - Value: `Bearer <CRON_SECRET>` (2번에서 정한 값)
- **Notifications**: Failures only (선택)
- **Schedule**: 아래 표의 cron 표현식 (cron-job.org 는 UTC 기준)

생성할 job 9개:

| Job name (URL `?job=`) | Schedule (UTC) | 의미 |
|---|---|---|
| `refresh-market` | `5,15,25,35,45,55 * * * *` | 매 10분 (5분 옵셋, GHA 패턴 그대로) |
| `us-prep-01` | `0 16 * * 0-4` | 일~목 16:00 UTC = 월~금 01:00 KST |
| `us-prep-06` | `0 21 * * 0-4` | 일~목 21:00 UTC = 월~금 06:00 KST |
| `kr-prep-11` | `0 2 * * 1-5` | 월~금 02:00 UTC = 월~금 11:00 KST |
| `kr-prep-16` | `0 7 * * 1-5` | 월~금 07:00 UTC = 월~금 16:00 KST |
| `watchdog-us-01` | `0 17 * * 0-4` | prep 1시간 뒤 — 슬롯 누락 시 prep 재발사 |
| `watchdog-us-06` | `0 22 * * 0-4` | 동일 |
| `watchdog-kr-11` | `0 3 * * 1-5` | 동일 |
| `watchdog-kr-16` | `0 8 * * 1-5` | 동일 |

### 4. 검증

- cron-job.org 대시보드 → 임의 job → "Run now" → 200 응답 확인
- GitHub Actions 페이지에서 해당 워크플로가 발사됐는지 확인
- 7개 cron 자연 트리거 후 다음날 모든 슬롯 채워졌는지 확인

## 보안 모델

- 외부 cron 이 임의 워크플로 발사 못 함 — endpoint 가 `ALLOWED_JOBS` 화이트리스트만 허용 (`src/lib/cron/dispatch.ts`)
- `CRON_SECRET` 없거나 일치 안 하면 401
- `GH_DISPATCH_TOKEN` 은 `actions:write` 만 가진 fine-grained PAT — 컨텐츠 수정 불가 (워크플로 발사만 가능)
- endpoint URL 자체는 공개돼도 무방 (secret 없으면 동작 안 함)

## 트러블슈팅

**cron-job.org job 실행이 401**: `Authorization` 헤더의 Bearer 값과 Vercel `CRON_SECRET` env var 일치 확인. Vercel 환경변수 변경 시 **Redeploy** 필수.

**500 "GH_DISPATCH_TOKEN missing"**: Vercel 환경변수 미등록. Redeploy 했는지 확인.

**502 GitHub API error 404**: PAT 의 repository access 가 `LingCun/lincoln-brief` 포함 안 됨, 또는 워크플로 파일이 main 에 없음.

**502 GitHub API error 422**: 워크플로의 `workflow_dispatch.inputs` 정의와 우리가 보낸 inputs 불일치. `ALLOWED_JOBS` 의 inputs 가 해당 .yml 의 `inputs:` 블록과 일치하는지 확인.

**워크플로 발사됐는데 실제 글 안 올라옴**: 이건 cron 문제 아님 — Claude Code Action 빈 손 종료 / Claude Code OAuth 토큰 만료 등. `actions/runs/<id>` 로그 확인.

## 기존 GHA schedule cron 제거 시점

Vercel cron 안정성 검증 후 (~1주). 제거 대상:
- `.github/workflows/refresh-market.yml` 의 `schedule:` 블록
- `.github/workflows/us-daily-prep.yml` 의 `schedule:` 블록
- `.github/workflows/kr-daily-prep.yml` 의 `schedule:` 블록
- `.github/workflows/watchdog.yml` 의 `schedule:` 블록

`workflow_dispatch:` 블록은 그대로 둘 것 — 외부 cron 이 이걸로 발사하니까.
