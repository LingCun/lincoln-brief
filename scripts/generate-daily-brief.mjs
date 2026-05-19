#!/usr/bin/env node
/**
 * 매일 평일 자동 생성되는 4개 카테고리 초안 (한 마켓당 4글).
 *
 *   US 배치 (06:00 KST, 미국 마감 직후)  → 4 카테고리 글, slug 접두 없음
 *   KR 배치 (16:00 KST, 한국 마감 직후)  → 4 카테고리 글, slug 접두 `kr-`
 *
 * 분기 기준: 환경변수 MARKET ('US' | 'KR'). 기본 'US'.
 *
 * 자동화 범위 (의도된 설계):
 *   - frontmatter, 가격표, 섬네일 SVG 뼈대까지만 자동
 *   - 본문 통찰 단락은 [TODO: Lincoln 검토] 마커. 사람이 채워야 발행됨.
 *   - 홈 페이지가 [TODO] 마커 있는 글은 자동으로 featured 후보에서 제외 →
 *     마커 지우면 그 글이 메인에 자동 노출.
 *
 * Usage:
 *   node scripts/generate-daily-brief.mjs           # MARKET=US 기본
 *   MARKET=KR node scripts/generate-daily-brief.mjs # 한국 배치
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'src/data/market-snapshot.json');
const POSTS_DIR = path.join(ROOT, 'src/content/blog');
const THUMBS_DIR = path.join(ROOT, 'public/thumbnails');

const MARKET = (process.env.MARKET || 'US').toUpperCase() === 'KR' ? 'KR' : 'US';

const TODO = '[TODO: Lincoln 검토]';

const CATEGORIES = [
  { slug: 'daily-brief',     name: '데일리 시황', accent: '#d8b878' },
  { slug: 'stock-analysis',  name: '종목 분석',   accent: '#5677b0' },
  { slug: 'market-forecast', name: '시장 예측',   accent: '#d96552' },
  { slug: 'economy-issue',   name: '경제 이슈',   accent: '#7a8c5a' },
];

// ── 날짜 유틸 (UTC → KST 변환) ─────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }
function kstNow() {
  // CI 에선 UTC, 로컬에선 로컬 시간 — 둘 다 KST 기준으로 통일.
  const utcMs = Date.now();
  return new Date(utcMs + 9 * 60 * 60 * 1000);
}
function ymd(d) { return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`; }
function isoDate(d) { return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }

// ── 포맷팅 ────────────────────────────────────────────────────
const f = (n, d = 2) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const p = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

function findIdx(snapshot, label) {
  return (snapshot ?? []).find((s) => s.label === label || s.symbol === label);
}

// ── 마켓별 컨텍스트 ───────────────────────────────────────────
function ctxFor(data, market) {
  if (market === 'KR') {
    const indices = data.kr?.snapshot ?? [];
    return {
      label: '한국',
      slugPrefix: 'kr-',
      asOf: `${kstNow().getUTCMonth() + 1}/${kstNow().getUTCDate()} 한국 마감 직후`,
      indices,
      primaryIdx: findIdx(indices, 'KOSPI'),
      secondaryIdx: findIdx(indices, 'KOSDAQ'),
      fxIdx: findIdx(indices, 'USD/KRW'),
      top12: (data.kr?.top12 ?? []).filter((c) => c.available),
      ccy: 'KRW',
      tickerCol: '한국 지수',
      tagsBase: ['KOSPI', 'KOSDAQ', 'USD/KRW'],
    };
  }
  // US 기본
  const indices = data.us?.snapshot ?? [];
  return {
    label: '미국',
    slugPrefix: '',
    asOf: `${kstNow().getUTCMonth() + 1}/${kstNow().getUTCDate()} 미국 마감 직후 (KST 06:00 기준)`,
    indices,
    primaryIdx: findIdx(indices, 'S&P 500'),
    secondaryIdx: findIdx(indices, 'NASDAQ'),
    fxIdx: null,
    top12: (data.us?.top12 ?? []).filter((c) => c.available),
    ccy: 'USD',
    tickerCol: '미국 지수',
    tagsBase: ['S&P500', 'NASDAQ', 'DOW'],
  };
}

// ── 가격표 (각 글 상단) ───────────────────────────────────────
function renderPriceTable(ctx) {
  const rows = [];
  if (ctx.primaryIdx) rows.push(`| ${ctx.primaryIdx.label} | **${f(ctx.primaryIdx.close)}** | ${p(ctx.primaryIdx.changePct)} |`);
  if (ctx.secondaryIdx) rows.push(`| ${ctx.secondaryIdx.label} | ${f(ctx.secondaryIdx.close)} | ${p(ctx.secondaryIdx.changePct)} |`);
  if (ctx.fxIdx) rows.push(`| ${ctx.fxIdx.label} | ${f(ctx.fxIdx.close)} | ${p(ctx.fxIdx.changePct)} |`);
  if (rows.length === 0) {
    return `_시세 데이터 fetch 실패 — fetch:market 재실행 권장._`;
  }
  return `| 지표 | 종가 | 변동 |\n|---|---|---|\n${rows.join('\n')}`;
}

function topMover(ctx) {
  if (!ctx.top12.length) return null;
  return [...ctx.top12].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0];
}

// ── 카테고리별 본문 스켈레톤 ─────────────────────────────────
function bodyFor(catSlug, ctx) {
  const priceTable = renderPriceTable(ctx);
  const mover = topMover(ctx);
  const moverLine = mover
    ? `- **${mover.name} (${mover.ticker})** — ${ctx.ccy === 'KRW' ? '₩' + f(mover.price, 0) : '$' + f(mover.price)} 마감, ${p(mover.changePct)}.`
    : `- ${TODO} 주연 종목`;

  switch (catSlug) {
    case 'daily-brief':
      return `> 한 줄 요약 — ${TODO} 오늘 ${ctx.label} 시장이 무엇을 말했는지 한 문장으로.

## ${ctx.label} 마감

${priceTable}

**핵심 모먼트.** ${TODO} 오늘 시장을 끌고 간 한 가지 테마.

## 종목 — 그날의 주연

${moverLine}
- ${TODO} 추가 주연 종목 2-3개 (수급·이벤트 기반)

## 시장은 무엇을 묻고 있나

${TODO} 사실 위에 얹는 한 단락의 해석.

## 한 줄 정리

> ${TODO} 글 전체를 받쳐주는 한 줄.

— Lincoln
`;
    case 'stock-analysis':
      return `> 한 줄 요약 — ${TODO} 오늘 분석할 종목과 핵심 한 문장.

## 종목 선정

${TODO} 오늘 ${ctx.label} 시장에서 한 종목을 골라 분석. 선정 이유 한 줄.

## 가격·변동

${priceTable}

${moverLine}

## 펀더멘털

${TODO} 매출·이익·시장 점유율·경쟁 구도 1-2 단락.

## 기술적 흐름

${TODO} 1년·3개월 차트에서 본 자리, 거래량 시그널.

## 결론

> ${TODO} *관찰 가치 있음 / 분할 매수 영역* 중 어느 톤인지.

— Lincoln
`;
    case 'market-forecast':
      return `> 한 줄 요약 — ${TODO} 향후 1-3개월 ${ctx.label} 시장의 가장 큰 변수 하나.

## 현재 위치

${priceTable}

## 단기 (1-2주) 시나리오

${TODO} 베이스·상·하 시나리오 각 한 줄.

## 중기 (1-3개월) 전망

${TODO} 거시·섹터 흐름.

## 다음 트리거 이벤트

- ${TODO} 이벤트 1 (예: FOMC, 한은 금통위, 빅테크 실적)
- ${TODO} 이벤트 2
- ${TODO} 이벤트 3

## 한 줄 정리

> ${TODO}

— Lincoln
`;
    case 'economy-issue':
      return `> 한 줄 요약 — ${TODO} 오늘 ${ctx.label} 시장 톱 이슈와 시장 반응의 의미.

## 이슈 — ${TODO} 제목

${TODO} 무슨 일이 벌어졌는지 사실관계 한 단락.

## 시장 반응

${priceTable}

${TODO} 시장이 가격으로 어떻게 답했는지 한 줄.

## 영향 분석

${TODO} 금리·환율·정책 채널로 풀어보기. 2-3 단락.

## 다음 주시할 것

- ${TODO}
- ${TODO}

> ${TODO} 한 줄 정리.

— Lincoln
`;
    default:
      return `${TODO} unknown category: ${catSlug}`;
  }
}

// ── frontmatter ───────────────────────────────────────────────
function tagsFor(catSlug, ctx) {
  const map = {
    'daily-brief':     ['시황', ...ctx.tagsBase],
    'stock-analysis':  ['종목분석', ctx.label === '한국' ? '한국주식' : '미국주식'],
    'market-forecast': ['시장예측', ctx.label === '한국' ? 'KOSPI' : 'S&P500'],
    'economy-issue':   ['경제이슈', '금리', '환율'],
  };
  return map[catSlug] ?? ['시황'];
}

function titleFor(catSlug, ctx, today) {
  const md = `${today.getUTCMonth() + 1}월 ${today.getUTCDate()}일`;
  const pct = ctx.primaryIdx ? p(ctx.primaryIdx.changePct) : TODO;
  const names = {
    'daily-brief':     `${md} ${ctx.label} 시황 — ${ctx.primaryIdx?.label ?? ctx.label} ${pct}`,
    'stock-analysis':  `${md} ${ctx.label} 종목 분석 — ${TODO} 종목 제목`,
    'market-forecast': `${md} ${ctx.label} 시장 예측 — ${TODO} 한 줄 헤드라인`,
    'economy-issue':   `${md} ${ctx.label} 경제 이슈 — ${TODO} 이슈 제목`,
  };
  return names[catSlug];
}

function descFor(catSlug, ctx) {
  const base = `${ctx.asOf} 기준`;
  const desc = {
    'daily-brief':     `${base} ${ctx.label} 마감 정리 + 다음 거래일 관전 포인트. 자동 생성 후 Lincoln 검토 발행.`,
    'stock-analysis':  `${base} ${ctx.label} 종목 한 개 심층 분석. 펀더멘털·기술·결론.`,
    'market-forecast': `${base} ${ctx.label} 단·중기 전망과 다음 트리거 이벤트.`,
    'economy-issue':   `${base} 오늘 ${ctx.label} 시장의 톱 경제 이슈와 영향 분석.`,
  };
  return desc[catSlug];
}

function buildFrontmatter(catSlug, ctx, today, slug) {
  const tags = tagsFor(catSlug, ctx);
  const fm = [
    `---`,
    `title: "${titleFor(catSlug, ctx, today)}"`,
    `description: "${descFor(catSlug, ctx)}"`,
    `pubDate: ${isoDate(today)}`,
    `thumbnail: /thumbnails/${slug}.svg`,
    `category: ${catSlug}`,
    `market: ${MARKET}`,
    `tags: [${tags.map((t) => `"${t}"`).join(', ')}]`,
    `readMinutes: 4`,
    `sources:`,
    `  - label: "Yahoo Finance"`,
    `    url: "https://finance.yahoo.com/"`,
    `---`,
  ];
  return fm.join('\n');
}

// ── 섬네일 SVG ────────────────────────────────────────────────
function renderThumbnail(catSlug, ctx, today) {
  const cat = CATEGORIES.find((c) => c.slug === catSlug);
  const dateLabel = `${today.getUTCFullYear()}.${pad(today.getUTCMonth() + 1)}.${pad(today.getUTCDate())}`;
  const idx = ctx.primaryIdx;
  const idxLabel = idx?.label ?? ctx.label.toUpperCase();
  const idxClose = idx ? f(idx.close) : '—';
  const idxPct = idx ? p(idx.changePct) : '';
  const idxUp = idx ? idx.changePct >= 0 : true;
  const accent = cat?.accent ?? '#d8b878';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1510"/><stop offset="100%" stop-color="#0f0c08"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.16"/><stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <circle cx="1000" cy="200" r="350" fill="url(#glow)"/>
  <line x1="80" y1="80" x2="200" y2="80" stroke="${accent}" stroke-width="1"/>
  <text x="220" y="84" font-family="Georgia, serif" font-style="italic" font-size="20" fill="#f5edd9">Lincoln</text>
  <text x="310" y="84" font-family="Georgia, serif" font-size="12" letter-spacing="6" fill="${accent}">BRIEF</text>
  <text x="80" y="200" font-family="monospace" font-size="13" letter-spacing="5" fill="${accent}">— ${ctx.label.toUpperCase()} · ${cat?.name ?? ''} —</text>
  <text x="80" y="290" font-family="Playfair Display, Georgia, serif" font-size="74" fill="#f5edd9">${today.getUTCMonth() + 1}월 ${today.getUTCDate()}일,</text>
  <text x="80" y="365" font-family="Playfair Display, Georgia, serif" font-size="74" font-style="italic" fill="${accent}">${cat?.name ?? ctx.label}</text>
  <text x="80" y="540" font-family="monospace" font-size="14" letter-spacing="4" fill="#988e72">${idxLabel} CLOSE</text>
  <text x="80" y="610" font-family="Playfair Display, Georgia, serif" font-size="80" font-weight="600" fill="#f5edd9">${idxClose}</text>
  <g transform="translate(${80 + Math.max(idxClose.length * 44, 420)}, 0)">
    ${idxUp
      ? '<polygon points="0,590 20,590 10,572" fill="#d96552"/>'
      : '<polygon points="0,572 20,572 10,590" fill="#5677b0"/>'}
    <text x="35" y="610" font-family="Playfair Display, Georgia, serif" font-size="40" font-weight="500" fill="${idxUp ? '#d96552' : '#5677b0'}">${idxPct}</text>
  </g>
  <line x1="80" y1="660" x2="1200" y2="660" stroke="#3d3326" stroke-width="1"/>
  <text x="80" y="685" font-family="monospace" font-size="11" letter-spacing="3" fill="#988e72">${dateLabel} · ${MARKET === 'KR' ? '16:00 KST' : '06:00 KST'}</text>
</svg>
`;
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  const data = JSON.parse(await fs.readFile(DATA, 'utf8'));
  const today = kstNow();
  const stamp = ymd(today);
  const ctx = ctxFor(data, MARKET);

  console.log(`[generate] market=${MARKET} date=${stamp} categories=${CATEGORIES.length}`);

  await fs.mkdir(POSTS_DIR, { recursive: true });
  await fs.mkdir(THUMBS_DIR, { recursive: true });

  for (const cat of CATEGORIES) {
    const slug = `${ctx.slugPrefix}${cat.slug}-${stamp}`;
    const fm = buildFrontmatter(cat.slug, ctx, today, slug);
    const body = bodyFor(cat.slug, ctx);
    const md = `${fm}\n\n${body}`;
    const postPath = path.join(POSTS_DIR, `${slug}.md`);
    const thumbPath = path.join(THUMBS_DIR, `${slug}.svg`);

    // 같은 슬러그가 이미 있으면 덮어쓰지 않음 (수동 편집 보호).
    try {
      await fs.access(postPath);
      console.log(`[generate] skip ${slug}.md (already exists)`);
      continue;
    } catch {
      // not exists — proceed
    }

    await fs.writeFile(postPath, md, 'utf8');
    await fs.writeFile(thumbPath, renderThumbnail(cat.slug, ctx, today), 'utf8');
    console.log(`[generate] wrote ${slug}.md + .svg`);
  }

  console.log(`\n[generate] ${CATEGORIES.length} 개 ${MARKET} 초안 작성 완료 (${TODO} 마커 포함).`);
  console.log(`           편집 → 마커 제거 → 자동으로 메인 노출 후보가 됨.`);
}

main().catch((err) => {
  console.error('[generate] failed:', err);
  process.exit(1);
});
