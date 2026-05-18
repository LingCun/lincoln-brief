# 썸네일 가이드

이 문서는 Lincoln Brief 썸네일 시스템 전체를 한 곳에 정리합니다. STYLE.md와 중복되는 부분은 *결정 기준* 만 옮기고, 여기엔 *실행 절차* 와 *디버깅* 을 중심으로 둡니다.

마지막 업데이트: 2026-05-18 (5/18 글 4편 누락 사고 후 회수 정리)

---

## 1. 먼저 알아야 할 것 — 왜 base64 인라인이 필수인가

사이트는 글 카드와 본문 헤더에서 SVG 썸네일을 이렇게 임베드합니다:

```astro
<img src={thumbnail} alt={title} />
<!-- 예: <img src="/thumbnails/kr-samsung-20260518.svg" /> -->
```

**브라우저는 `<img>` 로 로드된 SVG 안에서 `<image href>` 외부 참조를 차단합니다.** SVG-as-image 샌드박스 정책 때문입니다. 따라서:

- SVG 안에서 `<image href="/thumbnails/photos/xxx.jpg">` 로 사진을 참조해두면, dev에서는 보이지 않거나 빈 박스로 렌더됩니다.
- 해결책: `scripts/inline-thumbnail-photos.mjs` 가 모든 외부 사진 참조를 `data:image/jpeg;base64,...` 로 변환합니다.

> **규칙: 사진을 쓰는 SVG는 *반드시* `npm run inline:thumbnails` 통과 후 커밋한다.** 작성 중에는 파일 경로 참조가 편하니, 저장 직후 스크립트를 한 번 돌려서 self-contained로 만드는 흐름입니다.

스크립트는 idempotent — 이미 base64인 SVG는 스킵하므로 반복 실행해도 안전합니다.

---

## 2. 두 스타일 — 언제 어느 쪽을 쓰나

| 스타일 | 파일 크기 | 언제 |
|---|---|---|
| **사진 + 텍스트 오버레이** | 200~400KB | **정식 발행 글 전부 (기본값)** |
| 인포그래픽-only | 5~7KB | 자동 생성된 데일리 초안 *임시*, 또는 데이터 자체가 헤드라인 (예: "S&P 7,444 신고가") |

2026-05-14 STYLE.md 업데이트 이후 *기본은 사진 스타일*. 인포그래픽은 *예외 케이스* 라고 기억하세요.

---

## 3. 파일 위치·명명

```
public/thumbnails/
├── _template-photo.svg          ← 사진 스타일 표준 템플릿 (복사해서 시작)
├── [post-slug].svg              ← 글별 썸네일 (글 frontmatter thumbnail 경로와 정확히 일치해야 함)
└── photos/
    ├── _ATTRIBUTION.md          ← 모든 사진 1줄씩 출처 기록 (필수)
    ├── [photo-name].jpg         ← 1280×720 또는 1920×1080 jpg
    └── ...
```

**파일명 규칙**
- SVG: 글 파일명과 *동일한 슬러그* + `.svg`
  - 예: `src/content/blog/kr-samsung-20260518.md` → `public/thumbnails/kr-samsung-20260518.svg`
- 사진: 의미가 분명한 짧은 영문 (`samsung-hbm.jpg`, `kospi-board.jpg`, `won-dollar.jpg` 등)

**frontmatter 와 파일 동기화**
글에서 참조하는 thumbnail 경로와 실제 파일이 1글자라도 다르면 사이트에서 깨집니다. 새 글 작성 직후 다음 명령으로 *링크 무결성* 점검:

```powershell
cd C:\claude\lincoln-brief
# frontmatter의 thumbnail 경로 vs public/thumbnails/ 실파일 비교 (PowerShell)
Get-ChildItem src/content/blog/*.md | ForEach-Object {
  $f = $_
  $line = Select-String -Path $f -Pattern '^thumbnail:\s*(/thumbnails/.+\.svg)' | Select-Object -First 1
  if ($line) {
    $svg = ($line.Matches[0].Groups[1].Value).TrimStart('/')
    if (-not (Test-Path "public/$svg")) {
      Write-Host "MISSING: $($f.Name) → /$svg" -ForegroundColor Red
    }
  }
}
```

(이 스크립트를 `scripts/check-thumbnails.ps1` 로 저장해 두면 빌드 전 점검에 좋습니다 — 아직 만들어두지 않았으니 만들면 좋음.)

---

## 4. 사진 스타일 — 단계별 워크플로

### Step 1. 사진 고르기

우선순위 (STYLE.md 기준):
1. 기사 보도 사진 (출처 명시 + 리사이즈)
2. 회사 공식 보도자료 / 프레스킷 (Samsung Newsroom, NVDA Press 등)
3. 무료 스톡: [Unsplash](https://unsplash.com), [Pexels](https://pexels.com), [Pixabay](https://pixabay.com)
4. 공공 도메인: Wikimedia Commons (공인 사진)

**금지**
- CC-BY-NC (상업화 가능성 있는 본 프로젝트엔 부적합)
- 일반인 식별 가능한 사진
- 명시적 허가 없는 뉴스/저작권 사진

### Step 2. 사진 저장

- 1280×720 또는 1920×1080 jpg로 다운로드
- 파일명은 짧은 영문 슬러그 (`won-dollar-board.jpg`)
- 저장 위치: `public/thumbnails/photos/[이름].jpg`

### Step 3. `_ATTRIBUTION.md` 에 1줄 추가

```markdown
| `won-dollar-board.jpg` | https://unsplash.com/photos/xxxxxxx | Unsplash License | `kr-krw-1500-20260518` | 2026-05-18 |
```

출처 기록 없는 사진은 *사용하지 않는다* — 이 규칙을 어기면 미래 상업화·재배포 시 회수 불가능한 리스크가 됩니다.

### Step 4. 템플릿 복사 + 텍스트 교체

```powershell
cd C:\claude\lincoln-brief\public\thumbnails
copy _template-photo.svg kr-krw-1500-20260518.svg
```

복사한 SVG를 에디터로 열어 다음 4곳을 교체:

| 위치 | 템플릿 값 | 교체 예 |
|---|---|---|
| `<image href>` | `/thumbnails/photos/PLACEHOLDER.jpg` | `/thumbnails/photos/won-dollar-board.jpg` |
| 우상단 EDITION | `EDITION · CATEGORY` | `EDITION · ECONOMY ISSUE` |
| Eyebrow | `— EYEBROW LABEL —` | `— 2026.05.18 · KRW WATCH —` |
| 메인 헤드라인 (2줄) | `메인 헤드라인` / `두 번째 줄` | `원/달러 1,500원,` / `체제의 라인` |
| 부제 | `부제 또는 요약 문장 한 줄` | `17년 만의 세 번째 시도, 안착의 첫 날` |
| 우하단 KEY METRIC (선택) | `KEY METRIC` / `VALUE` | `USD/KRW` / `1,501.50` |
| 하단 메타 좌측 | `DATE · 06:00 KST` | `2026.05.18 · 15:30 KST` |
| 하단 메타 우측 | `PHOTO · ATTRIBUTION` | `PHOTO · UNSPLASH` |

### Step 5. base64 인라인

```powershell
cd C:\claude\lincoln-brief
npm run inline:thumbnails
```

출력에 `[ok] kr-krw-1500-20260518.svg — inlined 1 photo(s)` 가 보이면 성공. SVG 파일 크기가 5KB → 200KB대로 늘어나는 것이 정상.

### Step 6. dev 서버에서 확인

```powershell
npm run dev
```

브라우저에서 `http://localhost:4321/blog/kr-krw-1500-20260518/` 열어 상단 썸네일과 글 카드 둘 다 정상 렌더 확인.

---

## 5. 인포그래픽-only 스타일 — 언제 쓰나

다음 경우에만 사진 없이 SVG 직접 작성:
- 데이터 자체가 헤드라인 (예: "KOSPI 8,000 돌파")
- 차트·지수 시각화가 핵심 메시지
- 자동 생성 데일리 초안 (Lincoln 검토 전 임시)

참고 예: `public/thumbnails/kr-daily-brief-20260515.svg` (인포그래픽 단독, 일중 변동 라인 + 데이터 박스 4개).

다크 배경(`#1a1510` ↔ `#0a0907` 그라데이션) + 골드(`#d8b878`) + 변동 표시(▲ 청록 `#7fb3a8` / ▼ 적색 `#e8856b`) 톤은 사진 스타일과 동일하게 유지. 폰트는 헤드라인 *Playfair Display + Georgia 폴백*, 데이터는 *monospace*, 본문 부제는 *Pretendard*.

---

## 6. 5/18 글 4편 — 회수 작업 계획

현재 상태 (2026-05-18 기준):

| 글 | 카테고리 | 썸네일 | 권장 사진 |
|---|---|---|---|
| `kr-daily-brief-20260518.md` | daily-brief | ❌ 누락 | `kospi-trading-floor.jpg` (재활용 가능 — 5/14 글에서 deprecated 처리됨) 또는 인포그래픽-only |
| `kr-samsung-20260518.md` | stock-analysis | ❌ 누락 | `semiconductor-chip.jpg` 또는 새 삼성 사진 (5/14 글이 `server-datacenter.jpg` 사용 중이라 차별화) |
| `kr-kospi-box-20260518.md` | market-forecast | ❌ 누락 | `seoul-yeouido.jpg` 재활용 (5/14 `kr-kospi-8000` 글이 사용 중이지만 시리즈 톤 유지에 적합) |
| `kr-krw-1500-20260518.md` | economy-issue | ❌ 누락 | 신규 환율 사진 필요 (Unsplash "currency exchange board", "korean won dollar", "trading screen forex" 검색) |

**회수 우선순위 (제안)**
1. **kr-daily-brief-20260518** — 매일 발행물의 얼굴, 가장 먼저. 인포그래픽-only 가 가장 빠름 (5/15 글 SVG 복사 후 숫자만 교체)
2. **kr-samsung-20260518** — 종목 분석, 카드 노출 빈도 높음. 사진 스타일 권장
3. **kr-kospi-box-20260518** — `seoul-yeouido.jpg` 재활용으로 빠르게
4. **kr-krw-1500-20260518** — 새 사진 다운로드 필요, 가장 시간 걸림

---

## 7. 자주 하는 실수 (이번 사고 포함)

### ❌ 실수 1. 글 frontmatter에 `thumbnail:` 만 적고 SVG는 안 만든 채 푸시
**결과**: dev/배포 양쪽 모두 깨진 이미지. 이번 5/18 사고의 원인.
**예방**: 글 작성 후 *즉시* SVG 한 장 (인포그래픽-only라도 OK) 만들기. 또는 `thumbnail:` 줄 자체를 frontmatter에서 일시 삭제하면 사이트는 *썸네일 영역을 통째로 건너뜀* (PostCard.astro의 `{thumbnail && ...}` 가드).

### ❌ 실수 2. 사진 SVG를 만들고 `npm run inline:thumbnails` 안 돌림
**결과**: dev에서는 보이고 배포 환경에서는 깨질 수 있음 (브라우저별 SVG-as-image 정책 차이). 일관성 깨짐.
**예방**: PR/커밋 전 항상 인라인 스크립트 1회. CI에 추가 가능 (TODO).

### ❌ 실수 3. `_ATTRIBUTION.md` 갱신 누락
**결과**: 사진은 보이지만 출처 추적 불가. 라이선스 감사 시 사진 회수 필요할 수 있음.
**예방**: photos/ 폴더에 jpg를 *복사하기 전에* ATTRIBUTION 한 줄 먼저 추가하는 습관.

### ❌ 실수 4. SVG 파일명과 frontmatter 경로 오타
**결과**: 깨진 이미지. 콘솔에 404.
**예방**: 위 4-1의 PowerShell 점검 스크립트 또는 빌드 로그 확인.

### ❌ 실수 5. 원본과 옵시디언 사본 동기화 누락
**결과**: 한쪽에만 썸네일이 있음. 이번 5/18 글 자체도 옵시디언에만 먼저 들어간 동일 유형 사고가 있었음.
**예방**: 빌드 직전 양쪽 동기화 스크립트. (`sync-vault.bat` 만들 가치 있음 — 별도 TODO)

---

## 8. 빠른 체크리스트 (PR 또는 커밋 전)

```
□ src/content/blog/[slug].md frontmatter의 thumbnail 경로 작성됨
□ public/thumbnails/[slug].svg 파일 존재
□ 사진 사용 시 public/thumbnails/photos/[name].jpg 존재
□ photos/_ATTRIBUTION.md에 사진 출처 1줄 추가됨
□ npm run inline:thumbnails 실행해서 base64 인라인 완료
□ npm run dev 띄워서 카드 + 본문 헤더에서 정상 렌더 확인
□ npm run build 통과 (Pagefind 색인 포함)
□ 원본(C:\claude\lincoln-brief)과 옵시디언 사본(vault/개인/lincoln-brief) 양쪽 동기화
```

---

## 9. 참고 명령 모음

```powershell
# 의존성 설치 (최초 1회)
cd C:\claude\lincoln-brief
npm install

# dev 서버 (썸네일 작업 중 실시간 미리보기)
npm run dev

# base64 인라인 (사진 SVG 작성 후 필수)
npm run inline:thumbnails

# 전체 빌드 + Pagefind 색인
npm run build

# 빌드 결과 미리보기 (검색 동작 확인)
npm run preview
```

---

## 10. 향후 개선 아이디어 (TODO)

- [ ] `scripts/check-thumbnails.mjs` — frontmatter ↔ 실파일 무결성 점검
- [ ] `scripts/sync-vault.mjs` — 원본 ↔ 옵시디언 사본 자동 동기화
- [ ] CI에서 `inline:thumbnails` 누락 검출 (base64 미인라인 SVG 발견 시 실패)
- [ ] 자동 생성 스크립트(`generate-daily-brief.mjs`)가 인포그래픽-only 썸네일 *기본 1장* 도 함께 생성하도록 (현재는 글만 만듦 → 사람이 매번 SVG 따로 만드는 부담)
