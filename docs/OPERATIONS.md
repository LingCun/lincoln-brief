# Lincoln Brief — 운영 가이드

매일 점검·트러블슈팅·정기 유지보수.

> 아키텍처 (워크플로 구조, 프롬프트 체인) 은 [AUTOMATION.md](AUTOMATION.md) 참고.

---

## 1. 트리거 매뉴얼 실행

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

## 1.5. cron 발화 신뢰성

GitHub Actions 의 schedule trigger 는 free tier 에서 **70~80% 누락**된다 (시간당 6회 의도 → 실제 1~2회). 의도된 빈도가 중요한 워크플로 (특히 `Refresh market snapshot`) 는 **cron-job.org 외부 트리거로 `workflow_dispatch` 를 호출**해 신뢰성 보강.

- 설정 절차: [EXTERNAL-CRON.md](EXTERNAL-CRON.md)
- GitHub schedule 은 백업으로 유지 — 외부 트리거 죽어도 시간당 1~2회는 통과
- 누락 진단: `gh run list --workflow="Refresh market snapshot" --limit 100 --json createdAt,event` 으로 1시간당 실행 횟수 + `event` 분포 확인 (`workflow_dispatch` = 외부, `schedule` = GitHub)

증상별 대응:
- **외부 트리거 호출이 401** → PAT 만료. EXTERNAL-CRON.md §2-4 갱신 절차.
- **외부 트리거 호출이 422** → 워크플로 파일에 `workflow_dispatch:` 누락 또는 `ref` 가 존재하지 않는 브랜치.
- **외부+schedule 다 들어와도 실행이 없음** → 워크플로 자체 에러. `gh run list` 에 빨간 X 가 있는지 + `gh run view --log-failed`.

---

## 2. 트러블슈팅 — 자동화 파이프라인

### 증상: `Run completed: success` 인데 **글 0편 발행**
판단 기준: `git log --since="20 minutes ago" --oneline` 에 `data: ${MARKET} daily brief auto-generated for …` 커밋이 **없으면** 진짜 0편. Author 는 `claude[bot]`.

원인 후보 (확인 순서):
1. Action 단계 로그에 `Unexpected input(s) 'prompt_file'` → [AUTOMATION.md §3](AUTOMATION.md) 의 step output 방식 누락. 해결: `prompt: ${{ steps.load_prompt.outputs.PROMPT }}` 로 수정.
2. 모든 4개 슬러그가 이미 존재 → prompt 의 "skip existing" 규칙대로 정상. 같은 날 두 번째 실행하면 흔함. Action 의 Output report 단계 메시지 확인.
3. Safety gate 가 4편 전부 `draft: true` 처리 → prompt 8번 항목 확인. draft 만 푸시되거나 git diff 비어있을 수 있음.
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

## 3. 트러블슈팅 — 썸네일

### 실수 1. 글 frontmatter에 `thumbnail:` 만 적고 SVG는 안 만든 채 푸시
**결과**: dev/배포 양쪽 모두 깨진 이미지.
**예방**: 글 작성 후 *즉시* SVG 한 장 (인포그래픽-only라도 OK) 만들기. 또는 `thumbnail:` 줄 자체를 frontmatter에서 일시 삭제하면 사이트는 *썸네일 영역을 통째로 건너뜀* (PostCard.astro의 `{thumbnail && ...}` 가드).

### 실수 2. 사진 SVG를 만들고 `npm run inline:thumbnails` 안 돌림
**결과**: dev에서는 보이고 배포 환경에서는 깨질 수 있음 (브라우저별 SVG-as-image 정책 차이).
**예방**: PR/커밋 전 항상 인라인 스크립트 1회. CI 추가 후보.

### 실수 3. `_ATTRIBUTION.md` 갱신 누락
**결과**: 사진은 보이지만 출처 추적 불가. 라이선스 감사 시 사진 회수 필요할 수 있음.
**예방**: photos/ 폴더에 jpg를 *복사하기 전에* ATTRIBUTION 한 줄 먼저 추가하는 습관.

### 실수 4. SVG 파일명과 frontmatter 경로 오타
**결과**: 깨진 이미지. 콘솔에 404.
**예방**: [THUMBNAILS.md](THUMBNAILS.md) §링크 무결성 점검 PowerShell 스크립트 또는 빌드 로그 확인.

### 실수 5. 원본과 옵시디언 사본 동기화 누락
**결과**: 한쪽에만 썸네일이 있음.
**예방**: 빌드 직전 양쪽 동기화 스크립트. (`sync-vault.bat` 만들 가치 있음 — 별도 TODO)

---

## 4. 매일 모니터링 포인트

US 워크플로 (평일 01:00 + 06:00 KST, 하루 2회):
1. **01:05 KST**: `gh run list --workflow="Daily Market Brief (US, Claude Code)" --limit 1`
2. **06:05 KST**: 동일

KR 워크플로 (평일 11:00 + 16:00 KST, 하루 2회):
3. **11:05 KST**: `gh run list --workflow="Daily Market Brief (KR, Claude Code)" --limit 1`
4. **16:05 KST**: 동일

실패 시 즉시 `gh run view --log-failed`.

---

## 5. 정기 유지보수

- **분기 1회**: `scripts/fetch-market.mjs` 의 `KR_TOP_12` / `US_TOP_12` 시총 순서 갱신
- **카테고리 추가/삭제**: `src/consts.ts` 한 곳만 — zod 스키마·라우트·Keystatic·prompt 가 자동 반영 (단 prompt 의 4 카테고리 본문 지시는 직접 수정)
- **prompt 내 최근 글 슬러그 하드코딩**: `scripts/generation-prompt.md` 1번 항목. 동적 (최근 N편 자동 선택) 으로 리팩터 후보.

---

## 6. 개선 후보 (백로그)

- prompt 내 최근 글 슬러그 하드코딩 → glob 으로 동적 선택
- Safety gate 결과를 Job summary 에 구조화 출력 (현재 자유 텍스트)
- KR_TOP_12 자동 갱신 (KRX 시총 API 활용)
- 휴장일 감지 — 휴장 KST 날짜는 워크플로 자체를 skip
- `scripts/check-thumbnails.mjs` — frontmatter ↔ 실파일 무결성 점검
- `scripts/sync-vault.mjs` — 원본 ↔ 옵시디언 사본 자동 동기화
- CI에서 `inline:thumbnails` 누락 검출 (base64 미인라인 SVG 발견 시 실패)
- 자동 생성 스크립트가 인포그래픽-only 썸네일 *기본 1장* 도 함께 생성하도록
