# 외부 cron 트리거 (cron-job.org)

`Refresh market snapshot` 워크플로의 발화 신뢰성을 GitHub Actions schedule 한계 (free tier 에서 시간당 6회 의도 → 실제 1~2회 통과, 누락률 70~80%) 에서 벗어나기 위해 **외부 cron 서비스로 `workflow_dispatch` API 를 호출**한다.

GitHub Actions schedule 은 그대로 두고 백업으로만 동작 — 외부 트리거가 죽어도 시간당 1~2회는 통과.

---

## 1. 동작 원리

```
cron-job.org (1분~ 단위 cron)
        │  HTTPS POST
        ▼
api.github.com/repos/LingCun/lincoln-brief/actions/workflows/refresh-market.yml/dispatches
        │  Authorization: Bearer <PAT>
        ▼
workflow_dispatch 이벤트 발화 → 워크플로 실행
```

워크플로 파일의 `workflow_dispatch:` 트리거가 이미 활성화돼 있어서 추가 코드 변경은 없다.

---

## 2. 설정 — 1회만 하면 됨

### 2-1. GitHub Personal Access Token (PAT) 발급

**Fine-grained PAT 권장** (classic 보다 권한 축소 가능).

1. `https://github.com/settings/personal-access-tokens/new` 접속
2. 다음 값으로 발급:
   - **Token name**: `lincoln-brief-cron-trigger`
   - **Expiration**: 1 year (권장 — 만료되면 갱신)
   - **Repository access**: `Only select repositories` → `LingCun/lincoln-brief`
   - **Repository permissions**:
     - `Actions`: **Read and write**  ← 이것만 필수
     - `Metadata`: Read-only (자동 포함)
   - 나머지는 No access
3. `Generate token` → 화면에 표시되는 토큰 (`github_pat_...`) 을 **즉시 복사**. 다시는 볼 수 없음.

> classic PAT 으로 가려면: scope 는 `repo` (또는 더 좁게 `workflow` 단독). 단 classic 은 권한이 넓으므로 fine-grained 우선.

### 2-2. cron-job.org 가입 + cron job 등록

1. `https://cron-job.org` 가입 (Google 로그인 가능, 무료).
2. Dashboard → `Create cronjob`.
3. 다음 값 입력:

   | 필드 | 값 |
   |---|---|
   | Title | `lincoln-brief: refresh-market` |
   | URL | `https://api.github.com/repos/LingCun/lincoln-brief/actions/workflows/refresh-market.yml/dispatches` |
   | Schedule | Every **30 minutes** (`*/30` 또는 매시 :00/:30 — cron-job.org 무료 플랜의 일 실행 한도(100회/일) 를 피하려 일 48번으로 맞춤. 더 짧게 가면 한도 초과 알림이 옵니다. 워크플로의 `concurrency.group` 이 겹친 실행도 차단.) |
   | Request method | **POST** |

4. **Advanced** 탭:
   - **Request headers** 에 3개 추가:
     - `Authorization`: `Bearer github_pat_xxx...` (2-1 에서 발급한 토큰)
     - `Accept`: `application/vnd.github+json`
     - `X-GitHub-Api-Version`: `2022-11-28`
   - **Request body**: `{"ref":"main"}`
   - **Treat redirects as success**: ON (선택)
   - **Notifications**: 실패 시 이메일 알림 ON 권장

5. `Save`.

### 2-3. 동작 확인

1. cron-job.org 의 cron job 페이지에서 `Execute now` 버튼 클릭.
2. **응답 코드 204 No Content** 가 돌아와야 정상 (GitHub workflow_dispatch 의 성공 응답).
   - 401/403: PAT 권한 부족 또는 만료. 2-1 다시 확인.
   - 404: workflow 파일 경로/이름 오타. URL 의 `refresh-market.yml` 부분 확인.
   - 422: `ref` 가 잘못됐거나 워크플로에 `workflow_dispatch` 가 없음.
3. 1~2분 뒤 `gh run list --workflow="Refresh market snapshot" --limit 3` 으로 새 실행 확인. `event` 가 `workflow_dispatch` 인 항목이 있어야 함.

### 2-4. PAT 만료 갱신

1년 후 토큰 만료되면 cron 호출이 401 로 떨어진다. 갱신:

1. cron-job.org → 이메일 알림 (실패 통보) 확인
2. GitHub → Settings → Personal access tokens → 만료된 토큰의 **Regenerate token**
3. cron-job.org 의 cron job → Headers → `Authorization` 값 새 토큰으로 교체

---

## 3. 다른 워크플로로 확장 — Daily Brief 4개 슬롯

GitHub Actions schedule cron 의 누락 (시간당 1~2회 통과) 때문에 Daily Brief 워크플로도 정시 발화가 불안정. 외부 트리거를 도입하면 신뢰성 ↑.

§2 에서 만든 cron-job.org 계정에 **cron job 4개를 추가**하면 됨. 같은 PAT (v2 토큰) 4곳 모두 재사용. URL · 시각 · body 만 바꾸면 끝.

### 4개 cron job — 입력값 표

| Title | URL (전체) | Schedule (KST) | Request body |
|---|---|---|---|
| `us-daily-prep-01` | `https://api.github.com/repos/LingCun/lincoln-brief/actions/workflows/us-daily-prep.yml/dispatches` | **매일 00:00** | `{"ref":"main","inputs":{"slot":"01"}}` |
| `us-daily-prep-06` | `https://api.github.com/repos/LingCun/lincoln-brief/actions/workflows/us-daily-prep.yml/dispatches` | **매일 06:00** | `{"ref":"main","inputs":{"slot":"06"}}` |
| `kr-daily-prep-11` | `https://api.github.com/repos/LingCun/lincoln-brief/actions/workflows/kr-daily-prep.yml/dispatches` | **매일 11:00** | `{"ref":"main","inputs":{"slot":"11"}}` |
| `kr-daily-prep-16` | `https://api.github.com/repos/LingCun/lincoln-brief/actions/workflows/kr-daily-prep.yml/dispatches` | **매일 16:00** | `{"ref":"main","inputs":{"slot":"16"}}` |

### 공통 설정 (4개 모두)

- **Method**: `POST` (기본값 GET 이라 반드시 변경)
- **Request headers** (§2-2 의 3개 그대로):
  - `Authorization`: `Bearer <v2 토큰>`
  - `Accept`: `application/vnd.github+json`
  - `X-GitHub-Api-Version`: `2022-11-28`
- **Schedule 요일**: "매일" 로 두면 됨 — 워크플로 자체 cron 요일 (`0-5` / `1-5`) + skip 로직이 휴장일/주말 발사를 즉시 종료시킴

### 왜 publish · watchdog 는 외부 트리거 불필요한가

- **`us-daily-publish` / `kr-daily-publish`**: `workflow_run` 으로 prep 끝나면 자동 발사. prep 외부 트리거가 잘 돌면 publish 도 자동.
- **`watchdog`**: prep 의 안전망. prep 외부 트리거가 들어오면 watchdog 누락은 큰 문제 아님.

### 안전성 — 같은 슬롯 중복 발사돼도 OK

워크플로 내부에 3중 안전장치:
1. `concurrency` 그룹 — 같은 (market, slot) 동시 실행 차단
2. `Skip if today's slot already published` — main 에 4편 다 있으면 즉시 종료
3. `workflow_dispatch.inputs.slot` choice 검증 — 잘못된 값은 422 에러

GitHub schedule + cron-job.org 가 동시에 들어와도 Claude 호출은 한 번만.

### 검증

각 cron job 의 `Execute now` 응답이 **`204 No Content`** 면 정상. `200 OK` 가 떨어지면 Method 가 POST 가 아니거나 URL 끝에 `/dispatches` 누락.

---

## 4. 운영 비용

- cron-job.org 무료 플랜:
  - cron job 50개·1분 단위 등록 가능
  - **일 실행 한도: 약 100회/일** (한도 초과하면 이메일 알림 + 일시 정지). 이 한도를 넘지 않도록 schedule 을 잡아야 함.
  - Lincoln Brief 현재 cron 합계 = `refresh-market` 48/일 (30분 간격) + `*-daily-prep` 4슬롯/일 = **52/일** → 한도 절반 이하
  - 2026-05-24: 10분 간격(144/일)으로 돌렸다가 한도 초과로 막힌 적 있음. 20분(72/일)도 안전권이지만 더 여유 두려 30분으로 묶음. snapshot 신선도 손해 = 사용자가 보는 데이터가 최대 ~30분 stale 가능.
- GitHub Actions: workflow_dispatch 는 schedule 과 동일하게 무료 실행분으로 카운트. public repo 면 무제한 무료.

월 운영비 0원.

---

## 5. 대안 — 만약 cron-job.org 가 막히면

- **EasyCron** — 무료 플랜 더 제한적 (cron job 20개·5분 단위). 같은 방식.
- **Vercel Cron** — Vercel Hobby 무료는 일 2회만, Pro ($20/월) 이상 필요. Vercel 통합도는 좋지만 빈번 cron 비쌈.
- **Cloudflare Workers Cron Triggers** — 무료, 분 단위 가능, JS 한 줄로 fetch 호출. cron-job.org 대비 셋업 복잡도 ↑.
