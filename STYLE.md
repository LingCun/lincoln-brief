# Lincoln Brief — Writing Style Guide

이 문서는 Lincoln Brief 글 작성 시 따라야 할 톤·구조·참고자료를 정리합니다.
자동 생성 스크립트(`scripts/generate-daily-brief.mjs`)도 이 가이드 기준으로 초안을 만들도록 유지.

---

## 데이터 소스

| 시장 | 인터랙티브 (글쓰기 세션) | 자동화 (cron) |
|---|---|---|
| 미국 증시 | `UsStockInfo-*` MCP (Yahoo) | `yahoo-finance2` npm |
| 한국 증시 | **`korea-stock` MCP** (KRX + DART, `.mcp.json` 등록됨) | `^KS11`/`^KQ11` Yahoo 폴백 (KRX direct API 연동 TODO) |
| 환율·원자재·크립토 | Yahoo Finance | Yahoo Finance |

**원칙:**
- 한국 종목·지수·공시는 `korea-stock` MCP 우선 사용. Yahoo Finance 의 ^KS11/^KQ11 은 지수 종가만 제공, 외국인 매매/거래대금 등은 KRX MCP 만 가능.
- API 키 발급/등록: [docs/API_KEYS.md](./docs/API_KEYS.md) 참고.

## 참고 블로그

### 1순위 — press02 (Naver Blog)
- URL: **https://blog.naver.com/press02**
- 용도: 글 **스타일·포맷·톤**의 기준점.
- 적용 시점: 새 글 초안 작성 전, 또는 마무리 다듬기 전.
- 참고할 요소:
  - 제목 짓는 방식
  - 본문 구조 (들머리 → 섹션 → 마무리)
  - 인용·통계·스크린샷 배치
  - 닫는 톤 (단정 vs 신중)
- 주의: Claude Code의 WebFetch가 naver.com 도메인을 차단함. 직접 참조 불가 → 사용자가 발췌·요약 제공하거나, 특정 글 URL을 알려주면 그 글만 묘사하는 식으로 작업.

### 보조 — 기성 매체 톤
사실 보강이 필요할 때 (블룸버그·Reuters·Yahoo Finance 톤):
- **Morning Brew** — 친근 + 데이터 풍부
- **The Daily Upside** — 짧고 위트
- **Bloomberg Open / Pursuits** — 진지함 + 럭셔리
- **Robb Report** — 럭셔리 매거진 톤

---

## 글 구조 표준

데일리 시황 / 종목 분석 / 시장 예측 / 경제 이슈 — 카테고리에 무관하게 공통:

```
1. 한 줄 요약 (blockquote, 굵게 핵심)
2. 사실 영역  (표 + bullet, 정량 데이터)
3. 분석 영역  (사실 위에 얹는 한두 단락 해석)
4. 시나리오  (시장 예측·종목 분석에만, 확률 가중 표)
5. 한국 시장 시사점 (해외 글일 때)
6. Lincoln의 결론 (blockquote 형태, 행동 시그널 없이 관점만)
7. — Lincoln 사인오프
8. 법적 면책 (분석성 글 끝)
```

## 문장 규칙

- **단정 어조 금지** — "갈 것이다" → "가능성이 높다 / 시나리오 ○○%"
- **수익 인증 금지** — "내가 ○○에 매수했다" 류는 절대 X
- **종목 추천 어휘 회피** — "사세요" / "매수 추천" 대신 "관찰 가치 있음 / 분할 매수 영역 ○○"
- **이중 출처 원칙** — 같은 수치/뉴스를 최소 2곳에서 확인 후 인용
- **링컨 사인오프** — 글 끝에 `— Lincoln` (em-dash + 공백)

## 메타데이터 (frontmatter) 필수 항목

```yaml
title: 짧고 강한 카피, 30자 이내 권장
description: 글의 핵심 한 문단 요약 (검색·OG에 노출)
pubDate: YYYY-MM-DD
thumbnail: /thumbnails/[slug].svg
category: daily-brief | stock-analysis | market-forecast | economy-issue
tags: [최소 3개, 최대 8개]
featured: true|false  (홈 노출 여부, 보통 1개만)
readMinutes: 4~8 (정직하게)
sources:
  - label: 매체명 + 기사 제목
    url: https://...
```

## 썸네일 규칙

### 형식
- **1280×720 SVG**
- 다크 배경(`#1a1510` 또는 `#0f0c08`) + 골드 강조(`#d8b878`)
- 변동율 ▲/▼ 는 **SVG `<polygon>`** 으로 (유니코드 문자는 폰트 의존성 있음)
- 우상단에 에디션 라벨, 좌상단에 Lincoln Brief 마크

### **★ 사진 사용 원칙 (2026-05-14 업데이트)**

기존의 인포그래픽-only 스타일에서 **"사진 + 텍스트 오버레이"** 매거진 표지 스타일로 전환.

**규칙:**
1. **모든 본 기사 썸네일은 실제 사진 1장을 메인 시각 요소로 사용한다.**
   - 인포그래픽 onlу 썸네일은 자동화 fallback / 데이터 시각화가 핵심일 때만 허용
2. **사진 출처 우선순위:**
   - **(a) 기사에 실린 보도 사진** — 출처 명시 + 1280×720 리사이즈 + `public/thumbnails/photos/` 저장
   - **(b) 회사 공식 보도자료 / 프레스킷** (Samsung Newsroom, NVDA Press 등) — 보도자료는 보통 인용·재게 허용
   - **(c) 무료 라이선스 스톡** — [Unsplash](https://unsplash.com), [Pexels](https://pexels.com), [Pixabay](https://pixabay.com)
   - **(d) 공공 도메인** — Wikimedia Commons (인물 사진 / 역사 자료)
3. **저작권 안전망:**
   - 사용 사진의 출처를 글 본문 *Sources* 섹션 끝에 명기 (썸네일 사진: ○○○ 제공/Unsplash @photographer 등)
   - 상업적 라이선스 미확인 사진은 사용 금지
   - 인물 사진은 공인(정치인·CEO 등)에 한해 사용, 일반인 X
4. **기술 구현 (SVG에 사진 임베드):**
   ```svg
   <svg viewBox="0 0 1280 720">
     <!-- 사진을 배경 레이어로 (작성 시엔 file path 참조) -->
     <image href="/thumbnails/photos/article-slug.jpg" width="1280" height="720"
            preserveAspectRatio="xMidYMid slice"/>
     <!-- 가독성 위한 다크 그라데이션 오버레이 -->
     <rect width="1280" height="720" fill="url(#dark-overlay)"/>
     <text>제목</text>
   </svg>
   ```
   - 사진은 `public/thumbnails/photos/` 에 저장 (jpg 권장, 1280×720 또는 1920×1080 원본)
   - SVG는 `public/thumbnails/[slug].svg` (이미지 href 로 참조)
   - 다크 그라데이션 오버레이는 좌측 60% 영역에서 텍스트 대비 확보

5. **⚠️ 필수 후처리 — base64 인라인:**
   SVG 를 `<img>` 태그로 임베드하면 브라우저가 SVG 내부 `<image href>` 외부 참조를 보안 정책상 차단합니다 (SVG-as-image 샌드박스). 따라서 모든 썸네일 SVG 는 **사진을 base64 data URI 로 임베드해야 합니다.**

   ```bash
   npm run inline:thumbnails
   ```
   이 스크립트가 `public/thumbnails/*.svg` 안의 모든 `<image href="/thumbnails/photos/...">` 를 자동으로 `data:image/jpeg;base64,...` 로 변환합니다. idempotent — 이미 인라인된 SVG는 스킵.

   **작업 흐름:**
   1. SVG 작성 시엔 파일 경로 참조 (`/thumbnails/photos/xxx.jpg`) — 편집 편함
   2. 저장 후 `npm run inline:thumbnails` 실행
   3. SVG가 self-contained 되어 어떤 환경에서도 렌더 보장
5. **텍스트 오버레이 톤:**
   - 사진 위 텍스트는 **단 두세 요소만** — 헤드라인 + Eyebrow + (선택) 1개 수치
   - 너무 많은 정보는 인포그래픽 톤으로 회귀하니 자제
   - 골드 강조선·소형 다이아몬드 등 브랜드 시그니처는 유지

### 파일 조직

```
public/thumbnails/
├── photos/                          ← 원본 사진 (사용한 것만)
│   ├── 005930-samsung-hbm.jpg
│   ├── kospi-trading-floor.jpg
│   └── _ATTRIBUTION.md              ← 사진별 출처/라이선스 기록
├── kr-daily-brief-20260514.svg      ← 사진 임베드 + 텍스트 오버레이
├── kr-samsung-20260514.svg
└── ...
```

`_ATTRIBUTION.md` 는 모든 사진의 (1) 출처 URL (2) 라이선스 (3) 사용한 글 슬러그를 한 행씩 기록.
다운로드한 사진을 처음 사용할 때 반드시 1줄 추가.

### 인포그래픽 스타일이 더 적합한 경우 (사진 X 허용)

다음 경우에만 사진 없이 인포그래픽-only 썸네일 사용 가능:
- 데이터 자체가 헤드라인인 경우 (예: "S&P 7,444.25 신고가")
- 차트/지수 시각화가 핵심인 경우
- 자동 생성된 데일리 시황 초안 (사진 수동 추가 전 임시)

→ 인포그래픽 단독 사용 시 STYLE.md 의 *기존* 인포그래픽 규칙 적용.

### 데모

`public/thumbnails/_template-photo.svg` 가 사진 임베드 + 텍스트 오버레이 표준 템플릿입니다.
새 글 작성 시 이 파일 복사해서 시작하세요.

## 자동화와 사람의 역할 분리

- **자동(`scripts/generate-daily-brief.mjs`)**: 시세표·뼈대·썸네일
- **사람(Lincoln)**: 통찰 단락(`[TODO: Lincoln 검토]` 마커 영역), 시나리오 확률, 한 줄 정리

→ 자동화로 만든 글에 `[TODO]` 마커가 남아있는 채로 발행 금지.

---

마지막 업데이트: 2026-05-14
