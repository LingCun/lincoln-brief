#!/usr/bin/env node
/**
 * Lincoln Brief — Groq US 배치 1회 테스트
 *
 * 목적: US 데일리 브리프 4개 카테고리 글 + 썸네일을 Groq Llama 3.3 70B 로
 *       1회 자동 생성. workflow_dispatch 수동 트리거 전용. MVP — 검증 우선.
 *
 * 기존 generate-daily-brief.mjs 의 helper (CATEGORIES, kstNow, ymd, isoDate,
 * pad, f, p, ctxFor, findIdx, topMover, renderPriceTable, tagsFor, descFor,
 * renderThumbnail) 는 원본 파일을 수정하지 않기 위해 그대로 복사했음.
 * 원본은 폴백 경로로 그대로 유지.
 *
 * 차이점:
 *   - 본문은 [TODO] 마커 스켈레톤이 아니라 Groq 모델이 생성한 자체 완결형 한국어 글.
 *   - 출력 후 안전 가드 — `[TODO`, `매수 추천`, `확실히`, `반드시 상승` 검출 시
 *     frontmatter 에 `draft: true` 자동 부착.
 *   - 같은 슬러그 존재 시 skip (덮어쓰기 금지) — 기존 동작 유지.
 *
 * 환경변수:
 *   GROQ_API_KEY        — 필수. 없으면 명시적 fail.
 *   MARKET              — 기본 US. (이번 테스트는 US 전용 가드 적용)
 *   MODEL               — 선택. 기본 'llama-3.3-70b-versatile'
 *   MAX_TOKENS_PER_POST — 선택. 기본 4000
 *   TEMPERATURE         — 선택. 기본 0.5
 *
 * Usage:
 *   GROQ_API_KEY=... node scripts/generate-daily-brief-groq.mjs
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

const MODEL = process.env.MODEL || 'llama-3.3-70b-versatile';
const MAX_TOKENS_PER_POST = Number(process.env.MAX_TOKENS_PER_POST || 4000);
const TEMPERATURE = Number(process.env.TEMPERATURE ?? 0.5);

// ── helper 복사 (원본 generate-daily-brief.mjs 에서 변경 없이 그대로 가져옴) ────
const CATEGORIES = [
  { slug: 'daily-brief',     name: '데일리 시황', accent: '#d8b878' },
  { slug: 'stock-analysis',  name: '종목 분석',   accent: '#5677b0' },
  { slug: 'market-forecast', name: '시장 예측',   accent: '#d96552' },
  { slug: 'economy-issue',   name: '경제 이슈',   accent: '#7a8c5a' },
];

function pad(n) { return String(n).padStart(2, '0'); }
function kstNow() {
  const utcMs = Date.now();
  return new Date(utcMs + 9 * 60 * 60 * 1000);
}
function ymd(d) { return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`; }
function isoDate(d) { return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }

const f = (n, d = 2) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const p = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

function findIdx(snapshot, label) {
  return (snapshot ?? []).find((s) => s.label === label || s.symbol === label);
}

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

function tagsFor(catSlug, ctx) {
  const map = {
    'daily-brief':     ['시황', ...ctx.tagsBase],
    'stock-analysis':  ['종목분석', ctx.label === '한국' ? '한국주식' : '미국주식'],
    'market-forecast': ['시장예측', ctx.label === '한국' ? 'KOSPI' : 'S&P500'],
    'economy-issue':   ['경제이슈', '금리', '환율'],
  };
  return map[catSlug] ?? ['시황'];
}

function descFor(catSlug, ctx) {
  const base = `${ctx.asOf} 기준`;
  const desc = {
    'daily-brief':     `${base} ${ctx.label} 마감 정리 + 다음 거래일 관전 포인트. Groq 자동 생성 (1회 검증).`,
    'stock-analysis':  `${base} ${ctx.label} 종목 한 개 심층 분석. Groq 자동 생성 (1회 검증).`,
    'market-forecast': `${base} ${ctx.label} 단·중기 전망과 다음 트리거 이벤트. Groq 자동 생성 (1회 검증).`,
    'economy-issue':   `${base} 오늘 ${ctx.label} 시장의 톱 경제 이슈와 영향 분석. Groq 자동 생성 (1회 검증).`,
  };
  return desc[catSlug];
}

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

// ── Groq 카테고리별 시스템 프롬프트 ────────────────────────────────
const BASE_SYSTEM = `당신은 한국어 시장 브리핑 블로거 Lincoln 의 보조 작가입니다.

[규칙 — 절대 준수]
- 모든 글은 자연스러운 한국어로 작성. 분석적이고 침착한 톤.
- 매수 추천 어휘 금지 — "매수 추천", "사세요", "확실히", "반드시 상승", "반드시 오른다", "무조건", "추천" 같은 단정 표현 금지. 대신 "관찰 가치 있음", "분할 매수 영역", "가능성이 높다", "시나리오" 같은 신중한 어휘를 쓴다.
- 단정 어조 금지 — "갈 것이다" 가 아니라 "갈 가능성이 높다 / 시나리오 ○○%".
- 수익 인증 금지 — "내가 ○○에 매수했다" 류 표현 절대 X.
- 글의 길이는 본문(frontmatter 제외) 800~1500 단어 수준.
- 모든 수치 인용은 사용자가 제공한 데이터(JSON) 에서만 가져옴. 추정·허구·과거 기억 금지. 데이터에 없는 종목·지수·이벤트는 언급하지 않는다.
- 글 끝에 반드시 \`— Lincoln\` (em-dash + 공백) 으로 서명한다.
- 출력은 순수 markdown 본문만. frontmatter (---) 는 절대 출력하지 않는다. 제목(\\# H1) 도 출력하지 않는다 — 글 제목은 frontmatter 가 담당.
- 글 첫 줄은 \`> 한 줄 요약 — ...\` 형태의 blockquote 로 시작한다.
- 글 마지막은 \`— Lincoln\` 한 줄로 끝낸다.
- 광고/홍보 어휘 (\"베스트\", \"최고의 기회\" 등) 금지.

[Lincoln 의 글 구조 (참고)]
1. 한 줄 요약 (blockquote)
2. 사실 영역 (가격표 + bullet, 정량 데이터 — 사용자 데이터 그대로)
3. 분석 영역 (사실 위에 얹는 1~2 단락 해석)
4. 시나리오 / 다음 트리거 (해당 카테고리만)
5. 한국 시장 시사점 (선택)
6. Lincoln 의 결론 (blockquote — 행동 시그널 없이 관점만)
7. \`— Lincoln\` 사인오프`;

const CATEGORY_SYSTEM = {
  'daily-brief': `${BASE_SYSTEM}

[카테고리 — 데일리 시황]
오늘 미국 시장이 어떻게 마감했는지, 무엇이 시장을 끌고 갔는지를 정리한다.
- 사용자가 준 S&P 500, NASDAQ, DOW + Top 12 종목 데이터에서 "오늘의 주연" 1~3개를 골라 다룬다.
- 섹터·테마 흐름을 한 단락으로 묶는다 (AI / 빅테크 / 금융 / 에너지 등 데이터에서 보이는 흐름만).
- 마지막에 다음 거래일 관전 포인트 1~2 가지를 bullet 로.`,

  'stock-analysis': `${BASE_SYSTEM}

[카테고리 — 종목 분석]
사용자가 준 Top 12 중 한 종목을 골라 한 편 분석한다.
- 선정 이유 한 줄 (변동률·뉴스 흐름 기반, 단 사용자 데이터에 있는 수치만 인용).
- 가격·변동 표시.
- 펀더멘털 — 일반론 수준에서만 (사용자 데이터에 EPS·매출 같은 펀더멘털 수치가 없다면 "사용자 데이터 범위 밖" 이라 명시하고 가격·변동 흐름 중심으로 분석).
- 결론은 "관찰 가치 있음 / 분할 매수 영역" 톤. "매수 추천" 같은 단정 금지.`,

  'market-forecast': `${BASE_SYSTEM}

[카테고리 — 시장 예측]
미국 시장의 단기(1~2주) / 중기(1~3개월) 시나리오를 정리한다.
- 베이스·상·하 시나리오 각 한 단락.
- 다음 트리거 이벤트 3개를 bullet 로 (Fed, 빅테크 실적, 매크로 지표 등 일반적으로 알려진 카테고리만 — 구체 일자는 사용자 데이터에 없으면 명시하지 않는다).
- 단정 금지 — "가능성", "시나리오", "확률" 어휘 사용.`,

  'economy-issue': `${BASE_SYSTEM}

[카테고리 — 경제 이슈]
오늘 미국 시장이 가격으로 답한 "톱 경제 이슈" 한 가지를 골라 다룬다.
- 사용자 데이터에서 가장 큰 변동을 보인 종목·섹터를 단서로 이슈를 추정해도 좋으나, 구체 사건 (예: 특정 FOMC 발표 일자) 은 데이터에 없으면 일반적인 매크로 카테고리 (금리·환율·정책) 로만 풀어쓴다.
- 시장 반응을 가격표로 보여주고, 금리·환율·정책 채널 중 어느 쪽으로 시장이 답했는지 2~3 단락으로 분석.
- 마지막에 "다음 주시할 것" 2가지 bullet.`,
};

// ── 본문 컨텍스트 — Groq 유저 메시지 ─────────────────────────
function buildUserPrompt(catSlug, ctx, today, snapshotJson) {
  const todayLabel = `${today.getUTCFullYear()}-${pad(today.getUTCMonth() + 1)}-${pad(today.getUTCDate())} (KST)`;
  const catName = CATEGORIES.find((c) => c.slug === catSlug)?.name ?? catSlug;
  const priceTable = renderPriceTable(ctx);
  const mover = topMover(ctx);
  const moverLine = mover
    ? `오늘 변동률 절댓값이 가장 큰 종목 — ${mover.name} (${mover.ticker}): ${ctx.ccy === 'USD' ? '$' + f(mover.price) : '₩' + f(mover.price, 0)} 마감, ${p(mover.changePct)}`
    : '(Top mover 데이터 없음)';

  return `[오늘 날짜] ${todayLabel}
[카테고리] ${catName} (slug: ${catSlug})
[시장] 미국 (US)

[사용자가 제공한 시장 데이터 — JSON]
\`\`\`json
${snapshotJson}
\`\`\`

[참고: 사실 영역에 그대로 쓸 수 있는 가격표]
${priceTable}

[참고: 오늘의 주연 후보]
${moverLine}

[작성 지시]
위 데이터로 "${catName}" 글 한 편을 작성하세요.
- 본문(markdown) 만 출력. frontmatter (---) 출력 금지. H1 (\\#) 출력 금지.
- 첫 줄은 \`> 한 줄 요약 — ...\` blockquote.
- 마지막 줄은 \`— Lincoln\`.
- 800~1500 단어.
- 수치는 위 JSON 안에 있는 것만 인용. JSON 에 없는 종목·지수·이벤트는 만들지 않습니다.
- 금지 어휘: "매수 추천", "사세요", "확실히", "반드시 상승", "반드시 오른다", "무조건", "추천".`;
}

// ── 안전 가드 ─────────────────────────────────────────────────
const FORBIDDEN = ['매수 추천', '사세요', '확실히', '반드시 상승', '반드시 오른다', '무조건 상승'];
const TODO_MARKER = '[TODO';

function violations(body) {
  const hits = [];
  if (body.includes(TODO_MARKER)) hits.push('TODO 마커 잔존');
  for (const w of FORBIDDEN) {
    if (body.includes(w)) hits.push(`금지어: ${w}`);
  }
  if (!body.includes('— Lincoln')) hits.push('서명 누락 (— Lincoln)');
  return hits;
}

// ── frontmatter (draft 옵션) ──────────────────────────────────
function titleFor(catSlug, ctx, today) {
  const md = `${today.getUTCMonth() + 1}월 ${today.getUTCDate()}일`;
  const pct = ctx.primaryIdx ? p(ctx.primaryIdx.changePct) : '';
  const idxLabel = ctx.primaryIdx?.label ?? ctx.label;
  const names = {
    'daily-brief':     `${md} ${ctx.label} 시황 — ${idxLabel} ${pct}`.trim(),
    'stock-analysis':  `${md} ${ctx.label} 종목 분석`,
    'market-forecast': `${md} ${ctx.label} 시장 예측`,
    'economy-issue':   `${md} ${ctx.label} 경제 이슈`,
  };
  return names[catSlug] ?? `${md} ${ctx.label} 브리프`;
}

function buildFrontmatter(catSlug, ctx, today, slug, draft) {
  const tags = tagsFor(catSlug, ctx);
  const lines = [
    `---`,
    `title: "${titleFor(catSlug, ctx, today)}"`,
    `description: "${descFor(catSlug, ctx)}"`,
    `pubDate: ${isoDate(today)}`,
    `thumbnail: /thumbnails/${slug}.svg`,
    `category: ${catSlug}`,
    `market: ${MARKET}`,
    `tags: [${tags.map((t) => `"${t}"`).join(', ')}]`,
    `readMinutes: 5`,
  ];
  if (draft) lines.push(`draft: true`);
  lines.push(
    `sources:`,
    `  - label: "Yahoo Finance"`,
    `    url: "https://finance.yahoo.com/"`,
    `---`,
  );
  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  // 환경 검증
  if (!process.env.GROQ_API_KEY) {
    console.error('[generate-groq] FATAL: GROQ_API_KEY 환경변수가 없음.');
    console.error('  → https://console.groq.com/keys 에서 발급 후 GitHub repo Settings → Secrets 에 등록.');
    process.exit(1);
  }

  if (MARKET !== 'US') {
    console.error(`[generate-groq] FATAL: 이 스크립트는 1회 검증용으로 MARKET=US 전용입니다. (현재: ${MARKET})`);
    process.exit(1);
  }

  // Groq SDK lazy import (워크플로에서 npm install --no-save 후 사용)
  let Groq;
  try {
    ({ default: Groq } = await import('groq-sdk'));
  } catch (e) {
    console.error('[generate-groq] FATAL: groq-sdk import 실패. `npm install groq-sdk` 필요.');
    console.error(`  ${e?.message ?? e}`);
    process.exit(1);
  }

  const data = JSON.parse(await fs.readFile(DATA, 'utf8'));
  const today = kstNow();
  const stamp = ymd(today);
  const ctx = ctxFor(data, MARKET);

  // 모델에 넘길 JSON — 너무 크면 토큰 비용 폭증하므로 핵심만 슬림화.
  const slimSnapshot = {
    asOf: data.asOf,
    asOfLabel: data.asOfLabel,
    source: data.source,
    us: {
      snapshot: data.us?.snapshot ?? [],
      // top12 의 sparkline 은 30개 숫자 배열 — 토큰 절약 위해 최근 5개만 노출.
      top12: (data.us?.top12 ?? []).filter((c) => c.available).map((c) => ({
        ticker: c.ticker,
        name: c.name,
        price: c.price,
        change: c.change,
        changePct: c.changePct,
        currency: c.currency,
        recentSparkline: Array.isArray(c.sparkline) ? c.sparkline.slice(-5) : [],
      })),
    },
  };
  const snapshotJson = JSON.stringify(slimSnapshot, null, 2);

  console.log(`[generate-groq] market=${MARKET} date=${stamp} model=${MODEL} temp=${TEMPERATURE} maxTokens=${MAX_TOKENS_PER_POST}`);
  console.log(`[generate-groq] top12 종목 수: ${slimSnapshot.us.top12.length}`);

  await fs.mkdir(POSTS_DIR, { recursive: true });
  await fs.mkdir(THUMBS_DIR, { recursive: true });

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const summary = { success: [], skipped: [], failed: [], tokens: { in: 0, out: 0 } };

  for (const cat of CATEGORIES) {
    const slug = `${ctx.slugPrefix}${cat.slug}-${stamp}`;
    const postPath = path.join(POSTS_DIR, `${slug}.md`);
    const thumbPath = path.join(THUMBS_DIR, `${slug}.svg`);

    // 같은 슬러그가 이미 있으면 덮어쓰지 않음 (수동 편집 보호).
    try {
      await fs.access(postPath);
      console.log(`[generate-groq] skip ${slug}.md (already exists)`);
      summary.skipped.push(slug);
      continue;
    } catch {
      // not exists — proceed
    }

    const sys = CATEGORY_SYSTEM[cat.slug] ?? BASE_SYSTEM;
    const usr = buildUserPrompt(cat.slug, ctx, today, snapshotJson);

    let body;
    try {
      const t0 = Date.now();
      const completion = await client.chat.completions.create({
        model: MODEL,
        max_tokens: MAX_TOKENS_PER_POST,
        temperature: TEMPERATURE,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: usr },
        ],
      });
      const ms = Date.now() - t0;
      const usage = completion.usage;
      const text = completion.choices?.[0]?.message?.content ?? '';
      summary.tokens.in += usage?.prompt_tokens ?? 0;
      summary.tokens.out += usage?.completion_tokens ?? 0;
      console.log(`[generate-groq] ${cat.slug}: ${ms}ms in=${usage?.prompt_tokens} out=${usage?.completion_tokens} chars=${text.length}`);

      if (!text.trim()) {
        throw new Error('빈 응답');
      }
      body = text.trim();
    } catch (e) {
      console.error(`[generate-groq] ${cat.slug} 실패 — 이 카테고리만 skip, 다른 카테고리 계속 진행.`);
      console.error(`  ${e?.message ?? e}`);
      if (e?.status) console.error(`  HTTP status: ${e.status}`);
      summary.failed.push({ slug, reason: e?.message ?? String(e) });
      continue;
    }

    // 안전 가드 — 위반 검출 시 draft: true
    const hits = violations(body);
    const draft = hits.length > 0;
    if (draft) {
      console.warn(`[generate-groq] ${slug} 안전 가드 위반 (draft:true 자동 부착) — ${hits.join(', ')}`);
    }

    const fm = buildFrontmatter(cat.slug, ctx, today, slug, draft);
    const md = `${fm}\n\n${body}\n`;

    await fs.writeFile(postPath, md, 'utf8');
    await fs.writeFile(thumbPath, renderThumbnail(cat.slug, ctx, today), 'utf8');
    console.log(`[generate-groq] wrote ${slug}.md + .svg${draft ? ' (draft)' : ''}`);
    summary.success.push({ slug, draft, violations: hits });
  }

  // ── Summary ──
  console.log('\n========== SUMMARY ==========');
  console.log(`성공: ${summary.success.length} / 스킵: ${summary.skipped.length} / 실패: ${summary.failed.length}`);
  console.log(`총 토큰: in=${summary.tokens.in} out=${summary.tokens.out}`);
  if (summary.success.length) {
    console.log('\n[성공]');
    for (const s of summary.success) console.log(`  - ${s.slug}${s.draft ? ` (draft, 위반: ${s.violations.join('; ')})` : ''}`);
  }
  if (summary.skipped.length) {
    console.log('\n[스킵 — 같은 슬러그 존재]');
    for (const s of summary.skipped) console.log(`  - ${s}`);
  }
  if (summary.failed.length) {
    console.log('\n[실패 — Groq 호출 에러]');
    for (const s of summary.failed) console.log(`  - ${s.slug}: ${s.reason}`);
  }

  // GitHub Actions summary
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      '## Groq US 배치 결과',
      '',
      `- 모델: \`${MODEL}\` / temp=${TEMPERATURE} / max_tokens=${MAX_TOKENS_PER_POST}`,
      `- 성공: **${summary.success.length}** / 스킵: ${summary.skipped.length} / 실패: ${summary.failed.length}`,
      `- 총 토큰: in=${summary.tokens.in} out=${summary.tokens.out}`,
      '',
    ];
    if (summary.success.length) {
      lines.push('### 성공');
      for (const s of summary.success) lines.push(`- \`${s.slug}\`${s.draft ? ` (draft, ${s.violations.join('; ')})` : ''}`);
      lines.push('');
    }
    if (summary.skipped.length) {
      lines.push('### 스킵');
      for (const s of summary.skipped) lines.push(`- \`${s}\``);
      lines.push('');
    }
    if (summary.failed.length) {
      lines.push('### 실패');
      for (const s of summary.failed) lines.push(`- \`${s.slug}\` — ${s.reason}`);
      lines.push('');
    }
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join('\n'));
  }

  // 4개 모두 실패해도 워크플로는 exit 1 하지 않음 (마스터가 로그 보고 판단)
  // 단 stdout 으로 명시 — 워크플로 step 이 git diff 로 후속 처리.
}

main().catch((err) => {
  console.error('[generate-groq] uncaught:', err);
  process.exit(1);
});
