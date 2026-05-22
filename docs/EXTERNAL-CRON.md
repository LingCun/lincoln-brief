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
   | Schedule | Every **10 minutes** (또는 더 자주 — 워크플로의 `concurrency.group` 이 동시 실행 차단) |
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

## 3. 다른 워크플로로 확장

같은 패턴으로 다른 schedule cron 도 외부 트리거 가능. URL 의 워크플로 파일명만 바꾸면 됨:

- `daily-brief.yml` (US Daily Prep) — 평일 01:00 + 06:00 KST 트리거인데 schedule 누락 시 글 안 나옴. 외부 트리거가 가장 도움 될 후보.
- `kr-daily-brief.yml` (KR Daily Prep) — 평일 11:00 + 16:00 KST
- `watchdog.yml` 등

**한 가지 주의**: workflow_dispatch 로 호출할 때 `inputs` 가 정의된 워크플로면 body 에 inputs 도 넣어야 함:

```json
{"ref":"main","inputs":{"slot":"01"}}
```

각 워크플로 파일의 `workflow_dispatch.inputs` 정의 확인 후 맞춰서 호출.

---

## 4. 운영 비용

- cron-job.org 무료 플랜: cron job 50개·1분 단위·실패 알림 포함. Lincoln Brief 워크플로 전부 깔아도 무료 한도 안.
- GitHub Actions: workflow_dispatch 는 schedule 과 동일하게 무료 실행분으로 카운트. public repo 면 무제한 무료.

월 운영비 0원.

---

## 5. 대안 — 만약 cron-job.org 가 막히면

- **EasyCron** — 무료 플랜 더 제한적 (cron job 20개·5분 단위). 같은 방식.
- **Vercel Cron** — Vercel Hobby 무료는 일 2회만, Pro ($20/월) 이상 필요. Vercel 통합도는 좋지만 빈번 cron 비쌈.
- **Cloudflare Workers Cron Triggers** — 무료, 분 단위 가능, JS 한 줄로 fetch 호출. cron-job.org 대비 셋업 복잡도 ↑.
