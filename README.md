# Lincoln Brief

매일 아침 06:00 KST 발행되는 미국·한국 증시 마켓 브리프.

## 개발

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # 정적 빌드 + Pagefind 색인
npm run preview      # 빌드 결과 미리보기 (검색 동작)
```

## 자동화 (매일 06:00 KST 자동 발행)

### 로컬 테스트
```bash
# 1) 시장 데이터 수동 갱신
npm run fetch:market

# 2) 데일리 브리프 초안 생성 (마크다운 + 썸네일 SVG)
npm run generate:daily-brief
```

### GitHub Actions (운영 환경)

`.github/workflows/daily-brief.yml` 이 평일 매일 21:00 UTC (= 06:00 KST 다음 날) 자동 실행:

1. `fetch:market` — Yahoo Finance에서 실시간 시세 받아 `src/data/market-snapshot.json` 갱신
2. `generate:daily-brief` — 데이터 기반 마크다운 글 초안 + 썸네일 SVG 생성
3. `git commit + push` — 메인 브랜치에 자동 커밋
4. Vercel/Netlify 자동 배포 트리거됨 (별도 연결 필요)

생성된 글은 `[TODO: Lincoln 검토]` 마커가 포함된 **초안**. Lincoln이 통찰 단락을 채우고 마커 제거 후 정식 발행.

### 배포

1. GitHub에 push
2. [Vercel](https://vercel.com) 또는 [Cloudflare Pages](https://pages.cloudflare.com)에서 import
3. 자동 빌드 + 배포
4. 도메인 연결 (lincolnbrief.com 등)

## 글 작성 가이드

글을 새로 쓰거나 자동 생성된 초안을 다듬을 땐 [`STYLE.md`](./STYLE.md)를 먼저 보세요.

- 참고 블로그: **https://blog.naver.com/press02** — 스타일·포맷·톤의 기준점
- 글 구조 표준, 문장 규칙, frontmatter 양식, 썸네일 규칙 정리됨

## 한국 증시 데이터 (korea-stock-mcp)

한국 시장 데이터는 [korea-stock-mcp](https://github.com/jjlabsio/korea-stock-mcp)
MCP 서버로 제공됩니다. KRX(코스피·코스닥) + DART(공시·재무제표).

- 설정: `.mcp.json` 에 `korea-stock` 등록됨
- 필요한 환경 변수: `DART_API_KEY`, `KRX_API_KEY`
- 발급 방법: [docs/API_KEYS.md](./docs/API_KEYS.md)

키가 없으면 Yahoo Finance 의 ^KS11/^KQ11 폴백으로 지수만 표시됩니다.

## 폴더 구조

```
lincoln-brief/
├── src/
│   ├── content/blog/         # 글 마크다운 (.md, .mdx)
│   ├── components/           # Astro 컴포넌트
│   ├── layouts/              # 페이지 레이아웃
│   ├── pages/                # 라우트
│   ├── data/                 # 자동 갱신되는 시장 데이터
│   ├── styles/               # 글로벌 CSS
│   └── consts.ts             # 사이트 메타 + 카테고리
├── public/
│   ├── thumbnails/           # 글별 SVG 썸네일
│   ├── favicon.svg
│   └── lincoln-portrait.svg
├── scripts/
│   ├── fetch-market.mjs      # Yahoo Finance 데이터 fetch
│   └── generate-daily-brief.mjs  # 매일 글 초안 생성
└── .github/workflows/
    ├── daily-brief.yml       # 매일 06:00 KST cron
    └── deploy.yml            # 빌드 검증
```

## 검색 (Pagefind)

빌드 시 `pagefind --site dist` 가 글을 색인합니다.
`npm run dev` 시엔 검색이 동작하지 않습니다 (빌드 산출물 필요).
운영 환경에서는 `npm run build` 후 자동 활성화.

## 스택

- **Astro 4** + TypeScript (현재 Node 20 호환 폴백)
- **Tailwind CSS 3.4** + Typography
- **Pagefind** 1.x — 빌드 타임 검색
- **yahoo-finance2** — 시장 데이터
- **GitHub Actions** — cron 자동 발행

## 라이선스

콘텐츠: © Lincoln Brief — 무단 전재 금지
코드: 비공개 (개인 운영)
