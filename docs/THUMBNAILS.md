# 썸네일 가이드

Lincoln Brief 썸네일 시스템 절차·디버깅. 톤·결정 기준은 STYLE.md 가 단일 출처.

> 흔한 실수와 디버깅은 [OPERATIONS.md §3](OPERATIONS.md) 참고.

---

## 1. 먼저 — 왜 base64 인라인이 필수인가

사이트는 글 카드와 본문 헤더에서 SVG 썸네일을 이렇게 임베드:

```astro
<img src={thumbnail} alt={title} />
<!-- 예: <img src="/thumbnails/kr-samsung-20260518.svg" /> -->
```

**브라우저는 `<img>` 로 로드된 SVG 안에서 `<image href>` 외부 참조를 차단합니다** (SVG-as-image 샌드박스). 따라서:

- SVG 안에서 `<image href="/thumbnails/photos/xxx.jpg">` 로 사진을 참조해두면, dev에서는 안 보이거나 빈 박스로 렌더됨.
- 해결책: `scripts/inline-thumbnail-photos.mjs` 가 모든 외부 사진 참조를 `data:image/jpeg;base64,...` 로 변환.

> **규칙**: 사진 쓰는 SVG는 *반드시* `npm run inline:thumbnails` 통과 후 커밋. 스크립트는 idempotent — 이미 base64인 SVG는 스킵.

---

## 2. 두 스타일 — 언제 어느 쪽

| 스타일 | 파일 크기 | 언제 |
|---|---|---|
| **사진 + 텍스트 오버레이** | 200~400KB | **정식 발행 글 전부 (기본값)** |
| 인포그래픽-only | 5~7KB | 자동 생성 데일리 초안 *임시*, 또는 데이터 자체가 헤드라인 (예: "S&P 7,444 신고가") |

2026-05-14 STYLE.md 업데이트 이후 *기본은 사진 스타일*. 인포그래픽은 *예외 케이스*.

---

## 3. 파일 위치·명명

```
public/thumbnails/
├── _template-photo.svg          ← 사진 스타일 표준 템플릿 (복사해서 시작)
├── [post-slug].svg              ← 글별 썸네일 (글 frontmatter thumbnail 경로와 정확히 일치)
└── photos/
    ├── _ATTRIBUTION.md          ← 모든 사진 1줄씩 출처 기록 (필수)
    ├── [photo-name].jpg         ← 1280×720 또는 1920×1080 jpg
    └── ...
```

**파일명 규칙**
- SVG: 글 파일명과 *동일한 슬러그* + `.svg`
  - 예: `src/content/blog/kr-samsung-20260518.md` → `public/thumbnails/kr-samsung-20260518.svg`
- 사진: 의미가 분명한 짧은 영문 (`samsung-hbm.jpg`, `kospi-board.jpg`, `won-dollar.jpg`)

### 링크 무결성 점검

글에서 참조하는 thumbnail 경로와 실제 파일이 1글자라도 다르면 깨짐.

```powershell
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

`scripts/check-thumbnails.ps1` 로 저장해두면 빌드 전 점검에 좋음 — 아직 미작성.

---

## 4. 사진 스타일 워크플로

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

- 1280×720 또는 1920×1080 jpg
- 파일명은 짧은 영문 슬러그 (`won-dollar-board.jpg`)
- 저장 위치: `public/thumbnails/photos/[이름].jpg`

### Step 3. `_ATTRIBUTION.md` 에 1줄 추가

```markdown
| `won-dollar-board.jpg` | https://unsplash.com/photos/xxxxxxx | Unsplash License | `kr-krw-1500-20260518` | 2026-05-18 |
```

출처 기록 없는 사진은 *사용 금지* — 미래 상업화·재배포 시 회수 불가능한 리스크.

### Step 4. 템플릿 복사 + 텍스트 교체

```powershell
cd C:\claude\lincoln-brief\public\thumbnails
copy _template-photo.svg kr-krw-1500-20260518.svg
```

복사한 SVG 에디터로 열어 다음 위치 교체:

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

출력에 `[ok] kr-krw-1500-20260518.svg — inlined 1 photo(s)` 보이면 성공. 파일 크기 5KB → 200KB대로 늘어남이 정상.

### Step 6. dev 서버 확인

```powershell
npm run dev
```

브라우저에서 `http://localhost:4321/blog/kr-krw-1500-20260518/` 열어 상단 썸네일·글 카드 양쪽 정상 렌더 확인.

---

## 5. 인포그래픽-only 스타일

다음 경우에만 사진 없이 SVG 직접 작성:
- 데이터 자체가 헤드라인 (예: "KOSPI 8,000 돌파")
- 차트·지수 시각화가 핵심 메시지
- 자동 생성 데일리 초안 (Lincoln 검토 전 임시)

참고 예: `public/thumbnails/kr-daily-brief-20260515.svg` (일중 변동 라인 + 데이터 박스 4개).

다크 배경(`#1a1510` ↔ `#0a0907` 그라데이션) + 골드(`#d8b878`) + 변동 표시(▲ 청록 `#7fb3a8` / ▼ 적색 `#e8856b`) 톤은 사진 스타일과 동일. 폰트는 헤드라인 *Playfair Display + Georgia 폴백*, 데이터는 *monospace*, 부제는 *Pretendard*.

---

## 6. 커밋 전 체크리스트

```
□ src/content/blog/[slug].md frontmatter thumbnail 경로 작성됨
□ public/thumbnails/[slug].svg 존재
□ 사진 사용 시 public/thumbnails/photos/[name].jpg 존재
□ photos/_ATTRIBUTION.md 1줄 추가됨
□ npm run inline:thumbnails 실행 → base64 인라인 완료
□ npm run dev 카드 + 본문 헤더 정상 렌더 확인
□ npm run build 통과 (Pagefind 색인 포함)
□ 원본(C:\claude\lincoln-brief)과 옵시디언 사본 양쪽 동기화
```

---

## 7. 참고 명령

```powershell
npm install                  # 최초 1회
npm run dev                  # 실시간 미리보기
npm run inline:thumbnails    # 사진 SVG 작성 후 필수
npm run build                # 전체 빌드 + Pagefind 색인
npm run preview              # 빌드 결과 확인 (검색 동작 검증)
```
