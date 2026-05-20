#!/usr/bin/env node
/**
 * 매일 새벽 6시 KST cron이 호출:
 *  1) Yahoo Finance에서 미국 증시 + 환율·원자재 데이터
 *  2) KRX OpenAPI에서 한국 증시 (KOSPI/KOSDAQ + 거래대금 등) — KRX_API_KEY 있을 때만
 *  3) DART에서 공시 (선택, 향후 확장)
 *
 * 결과: src/data/market-snapshot.json
 *
 * 환경변수:
 *   KRX_API_KEY  - 한국거래소 OpenAPI 키 (없으면 한국 섹션 스킵)
 *   DART_API_KEY - 전자공시시스템 키 (현재 미사용, 향후 종목 분석용)
 */
import YahooFinance from 'yahoo-finance2';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// yahoo-finance2 v2.14+ 는 default export 가 클래스 → 인스턴스화 필요
const yahooFinance = new YahooFinance();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.resolve(__dirname, '../src/data/market-snapshot.json');

// ============================================================
// Top 12 by market cap — KR / US
// MarketSnapshot.astro 가 이걸로 카드 그리드 렌더.
// 시총 변동되면 순서/구성 손으로 조정 (자주 안 바뀜).
// ============================================================
const KR_TOP_12 = [
  { ticker: '005930.KS', name: '삼성전자' },
  { ticker: '000660.KS', name: 'SK하이닉스' },
  { ticker: '373220.KS', name: 'LG에너지솔루션' },
  { ticker: '207940.KS', name: '삼성바이오로직스' },
  { ticker: '005380.KS', name: '현대차' },
  { ticker: '000270.KS', name: '기아' },
  { ticker: '005490.KS', name: 'POSCO홀딩스' },
  { ticker: '105560.KS', name: 'KB금융' },
  { ticker: '035420.KS', name: 'NAVER' },
  { ticker: '068270.KS', name: '셀트리온' },
  { ticker: '055550.KS', name: '신한지주' },
  { ticker: '035720.KS', name: '카카오' },
];

const US_TOP_12 = [
  { ticker: 'NVDA',  name: 'NVIDIA' },
  { ticker: 'MSFT',  name: 'Microsoft' },
  { ticker: 'AAPL',  name: 'Apple' },
  { ticker: 'GOOGL', name: 'Alphabet' },
  { ticker: 'AMZN',  name: 'Amazon' },
  { ticker: 'META',  name: 'Meta' },
  { ticker: 'TSLA',  name: 'Tesla' },
  { ticker: 'BRK-B', name: 'Berkshire B' },
  { ticker: 'AVGO',  name: 'Broadcom' },
  { ticker: 'LLY',   name: 'Eli Lilly' },
  { ticker: 'JPM',   name: 'JPMorgan' },
  { ticker: 'WMT',   name: 'Walmart' },
];

// ============================================================
// 미국 + 글로벌 (Yahoo Finance) — 기존 호환용 (다른 데가 쓸 수도 있어 보존)
// ============================================================
const US_SNAPSHOT = [
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^IXIC', label: 'NASDAQ' },
  { symbol: '^DJI',  label: 'DOW' },
  { symbol: 'NVDA',  label: 'NVDA' },
];

const TICKER = [
  { symbol: '^GSPC', label: 'S&P 500',  type: 'index',     market: 'us' },
  { symbol: '^IXIC', label: 'NASDAQ',   type: 'index',     market: 'us' },
  { symbol: '^DJI',  label: 'DOW',      type: 'index',     market: 'us' },
  { symbol: 'NVDA',  label: 'NVDA',     type: 'stock',     market: 'us' },
  { symbol: 'TSLA',  label: 'TSLA',     type: 'stock',     market: 'us' },
  { symbol: 'AAPL',  label: 'AAPL',     type: 'stock',     market: 'us' },
  { symbol: 'KRW=X', label: 'USD/KRW',  type: 'fx',        market: 'fx' },
  { symbol: 'BTC-USD', label: 'BTC',    type: 'crypto',    market: 'crypto' },
  { symbol: 'GC=F',  label: 'GOLD',     type: 'commodity', market: 'commodity' },
  { symbol: 'CL=F',  label: 'WTI',      type: 'commodity', market: 'commodity' },
  { symbol: '^TNX',  label: 'US10Y',    type: 'yield',     market: 'yield' },
];

const fmtNum = (n, d = 2) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const fmtValue = (val, type) => {
  if (type === 'stock')     return '$' + fmtNum(val, 2);
  if (type === 'crypto')    return '$' + fmtNum(val, 0);
  if (type === 'commodity') return '$' + fmtNum(val, 2);
  if (type === 'yield')     return fmtNum(val, 3) + '%';
  if (type === 'fx')        return fmtNum(val, 2);
  return fmtNum(val, 2);
};

function noteForChange(pct) {
  if (pct >= 1.5) return '강한 상승';
  if (pct >= 0.5) return '상승';
  if (pct > -0.5) return '보합';
  if (pct > -1.5) return '하락';
  return '큰 폭 하락';
}

async function quoteSafe(symbol) {
  try {
    return await yahooFinance.quote(symbol);
  } catch (e) {
    console.warn(`[warn] failed to fetch ${symbol}:`, e.message);
    return null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
};

/**
 * Yahoo Finance public chart endpoint — crumb 인증 불필요.
 * 단일 호출로 price/prevClose/currency + 일일 종가 배열 모두 받음.
 * 결과: { price, previousClose, currency, exchangeName, closes:[number] }  또는 null.
 */
async function fetchChartDirect(ticker, range = '2mo') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${range}`;
  try {
    const res = await fetch(url, { headers: YAHOO_HEADERS });
    if (!res.ok) {
      console.warn(`[warn] chart HTTP ${res.status} for ${ticker}`);
      return null;
    }
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta ?? {};
    const closes = (result.indicators?.quote?.[0]?.close ?? []).filter((v) => v != null);
    return {
      price: meta.regularMarketPrice ?? null,
      previousClose: meta.previousClose ?? meta.chartPreviousClose ?? null,
      currency: meta.currency ?? null,
      exchangeName: meta.exchangeName ?? null,
      closes,
    };
  } catch (e) {
    console.warn(`[warn] chart fetch failed for ${ticker}:`, e.message);
    return null;
  }
}

/**
 * 12개 ticker → price + change + 30일 sparkline.
 * Yahoo chart 엔드포인트 (crumb 불필요) 만 사용 → 429 회피.
 * 결과 항목: { ticker, name, price, change, changePct, currency, sparkline:[number], available:boolean }
 */
async function fetchTop12(items, label) {
  console.log(`[fetch] ${label} top12 (direct chart endpoint)…`);
  const results = [];
  for (const item of items) {
    const chart = await fetchChartDirect(item.ticker, '2mo');
    if (!chart || chart.price == null) {
      results.push({ ticker: item.ticker, name: item.name, available: false, sparkline: [] });
    } else {
      // meta.previousClose 는 차트 range 첫 점 이전 가격을 반환 → 60일 전 값이 잡힘.
      // 직전 거래일 종가는 sparkline 마지막 두 점으로 계산.
      const closes = chart.closes;
      const prev = closes.length >= 2 ? closes[closes.length - 2] : chart.previousClose ?? chart.price;
      const change = chart.price - prev;
      const changePct = prev ? (change / prev) * 100 : 0;
      results.push({
        ticker: item.ticker,
        name: item.name,
        price: chart.price,
        change,
        changePct,
        currency: chart.currency ?? null,
        exchange: chart.exchangeName ?? null,
        sparkline: chart.closes.slice(-30),
        available: true,
      });
    }
    await sleep(200);
  }
  return results;
}

async function fetchUS() {
  const snapshot = [];
  for (const s of US_SNAPSHOT) {
    const q = await quoteSafe(s.symbol);
    if (!q) continue;
    const pct = q.regularMarketChangePercent ?? 0;
    snapshot.push({
      symbol: s.symbol,
      label: s.label,
      close: q.regularMarketPreviousClose ?? q.regularMarketPrice ?? 0,
      change: q.regularMarketChange ?? 0,
      changePct: pct,
      note: noteForChange(pct),
    });
  }
  return snapshot;
}

async function fetchTicker() {
  const ticker = [];
  for (const t of TICKER) {
    const q = await quoteSafe(t.symbol);
    if (!q) continue;
    const pct = q.regularMarketChangePercent ?? 0;
    ticker.push({
      symbol: t.label,
      value: fmtValue(q.regularMarketPrice ?? q.regularMarketPreviousClose ?? 0, t.type),
      change: fmtPct(pct),
      up: pct >= 0,
      market: t.market,
    });
  }
  return ticker;
}

// ============================================================
// 한국 (KRX OpenAPI - 직접 호출)
//
// KRX OpenAPI: openapi.krx.co.kr
// 엔드포인트 예: /svc/apis/sto/stk_bydd_trd (코스피 종목별 일별 거래)
// 인증: Bearer token / AUTH_KEY 헤더
//
// ⚠️ KRX API 가 승인되기 전엔 fetchKorea() 가 null 반환 → UI는 자동으로 코너 메시지 표시.
// 승인 후 KRX_API_KEY 환경변수 설정만 하면 자동 활성화.
// ============================================================
async function fetchKorea() {
  // KRX API 키가 있으면 KRX direct 우선 (외국인 매매·거래대금 등 확장 가능),
  // 없으면 Yahoo Finance ^KS11/^KQ11 폴백으로라도 한국 지수를 채운다.
  // (이전 버전은 KRX_API_KEY 없을 때 early return 되어 Korea 섹션이 비어있었음.)
  const hasKrx = !!process.env.KRX_API_KEY;
  if (!hasKrx) {
    console.log('[info] KRX_API_KEY not set — using Yahoo Finance fallback for Korea');
  }

  try {
    // TODO: hasKrx === true 일 때 KRX OpenAPI 직접 호출로 교체 (외국인 매매 등)
    const [kospi, kosdaq, krw] = await Promise.all([
      quoteSafe('^KS11'),
      quoteSafe('^KQ11'),
      quoteSafe('KRW=X'),
    ]);

    const snapshot = [];

    if (kospi) {
      const pct = kospi.regularMarketChangePercent ?? 0;
      snapshot.push({
        symbol: 'KOSPI',
        label: 'KOSPI',
        close: kospi.regularMarketPrice ?? kospi.regularMarketPreviousClose ?? 0,
        change: kospi.regularMarketChange ?? 0,
        changePct: pct,
        note: noteForChange(pct),
      });
    }
    if (kosdaq) {
      const pct = kosdaq.regularMarketChangePercent ?? 0;
      snapshot.push({
        symbol: 'KOSDAQ',
        label: 'KOSDAQ',
        close: kosdaq.regularMarketPrice ?? kosdaq.regularMarketPreviousClose ?? 0,
        change: kosdaq.regularMarketChange ?? 0,
        changePct: pct,
        note: noteForChange(pct),
      });
    }
    if (krw) {
      const pct = krw.regularMarketChangePercent ?? 0;
      snapshot.push({
        symbol: 'USDKRW',
        label: 'USD/KRW',
        close: krw.regularMarketPrice ?? krw.regularMarketPreviousClose ?? 0,
        change: krw.regularMarketChange ?? 0,
        changePct: pct,
        note: noteForChange(pct),
      });
    }

    return {
      available: snapshot.length > 0,
      note: 'Yahoo Finance fallback. KRX OpenAPI 활성화 시 외국인 매매·거래대금 등 확장 가능.',
      snapshot,
    };
  } catch (e) {
    console.warn('[warn] Korea fetch failed:', e.message);
    return null;
  }
}

// ============================================================
// 병렬 데이터 소스 (Yahoo deny list 대비 1주차 검증용)
//
// 야후가 `host_not_allowed` 로 자주 차단당해서 무료/키 불필요 대안 API 를
// 같은 워크플로에서 병렬로 호출, 결과를 snapshot.alt 에 따로 기록한다.
// 사용자 화면엔 영향 없고, 며칠 모은 diff 로 값이 일치하는지 검증 후 본채널 교체.
//
// Frankfurter: ECB 기반 환율. 키 불필요, 무제한.
// CoinGecko:   거래소 가중평균 코인 시세. 키 불필요, 분당 10–30 호출.
// ============================================================

const ALT_HEADERS = {
  'User-Agent': 'lincoln-brief-bot/1.0 (+https://lincoln-brief.vercel.app)',
  Accept: 'application/json',
};

async function fetchFrankfurterFx() {
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=KRW', { headers: ALT_HEADERS });
    if (!res.ok) {
      console.warn(`[alt] frankfurter HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const rate = data?.rates?.KRW;
    if (rate == null) return null;
    return { source: 'frankfurter', usdKrw: rate, asOf: data.date ?? null };
  } catch (e) {
    console.warn('[alt] frankfurter failed:', e.message);
    return null;
  }
}

async function fetchCoinGeckoBtc() {
  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true';
    const res = await fetch(url, { headers: ALT_HEADERS });
    if (!res.ok) {
      console.warn(`[alt] coingecko HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const btc = data?.bitcoin;
    if (!btc?.usd) return null;
    return {
      source: 'coingecko',
      btcUsd: btc.usd,
      change24hPct: btc.usd_24h_change ?? null,
      asOf: btc.last_updated_at ? new Date(btc.last_updated_at * 1000).toISOString() : null,
    };
  } catch (e) {
    console.warn('[alt] coingecko failed:', e.message);
    return null;
  }
}

/**
 * Yahoo 와 alt API 값 나란히 로깅. CI 로그에서 며칠 관찰해 수치 일치 확인.
 * 양쪽 다 있을 때만 delta 계산, 없으면 단순 표시.
 */
function logAltDiff(label, yahooVal, altVal, fmt = (v) => v) {
  const y = yahooVal == null ? 'n/a' : fmt(yahooVal);
  const a = altVal == null ? 'n/a' : fmt(altVal);
  if (yahooVal != null && altVal != null) {
    const delta = altVal - yahooVal;
    const deltaPct = yahooVal ? (delta / yahooVal) * 100 : 0;
    console.log(`[diff] ${label}: yahoo=${y}  alt=${a}  Δ=${delta.toFixed(2)} (${deltaPct.toFixed(3)}%)`);
  } else {
    console.log(`[diff] ${label}: yahoo=${y}  alt=${a}  (한쪽 누락)`);
  }
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('[fetch] starting market data fetch…');

  // 순차 실행 — Yahoo는 동시 호출 많으면 즉시 429 던짐.
  const krTop12 = await fetchTop12(KR_TOP_12, 'KR');
  const usTop12 = await fetchTop12(US_TOP_12, 'US');
  const usSnapshot = await fetchUS();
  const ticker = await fetchTicker();
  const kr = await fetchKorea();

  // 병렬 (alt) 소스 — 야후 차단 대비 검증용. 본채널 데이터엔 영향 없음.
  const [yahooKrwForDiff, yahooBtcForDiff, altFx, altBtc] = await Promise.all([
    quoteSafe('KRW=X'),
    quoteSafe('BTC-USD'),
    fetchFrankfurterFx(),
    fetchCoinGeckoBtc(),
  ]);

  const yahooKrwVal = yahooKrwForDiff?.regularMarketPrice ?? yahooKrwForDiff?.regularMarketPreviousClose ?? null;
  const yahooBtcVal = yahooBtcForDiff?.regularMarketPrice ?? yahooBtcForDiff?.regularMarketPreviousClose ?? null;
  logAltDiff('FX USD/KRW', yahooKrwVal, altFx?.usdKrw ?? null, (v) => v.toFixed(2));
  logAltDiff('BTC/USD   ', yahooBtcVal, altBtc?.btcUsd ?? null, (v) => v.toFixed(0));

  // 안전 가드: 모든 외부 호출 실패 시 기존 JSON 보존.
  const krOk = krTop12.some((c) => c.available);
  const usOk = usTop12.some((c) => c.available);
  const allEmpty =
    usSnapshot.length === 0 && ticker.length === 0 && (!kr || !kr.available) && !krOk && !usOk;
  if (allEmpty) {
    // 외부 소스 전부 실패 — 기존 스냅샷이 그대로 남아 사이트는 정상 동작.
    // 호출 측 (daily-brief 등) 이 이 단계 실패로 죽지 않도록 exit 0 으로 마무리.
    // "::warning::" prefix 로 GitHub Actions UI 엔 노란 경고는 남긴다.
    console.error('::warning::[fetch] all sources empty (likely Yahoo throttle / network). Preserving existing snapshot.');
    return;
  }

  const now = new Date();
  const out = {
    asOf: now.toISOString(),
    asOfLabel: `${now.getMonth() + 1}/${now.getDate()} 한국·미국 마감`,
    source: kr?.available ? 'Yahoo Finance · KRX' : 'Yahoo Finance',
    us: { snapshot: usSnapshot, top12: usTop12 },
    kr: {
      ...(kr ?? {
        available: false,
        note: 'KRX_API_KEY 미설정 + Yahoo 폴백 실패.',
        snapshot: [],
      }),
      top12: krTop12,
    },
    // Backwards compat (older components read top-level snapshot)
    snapshot: usSnapshot,
    ticker,
    // 1주차 병렬 검증 데이터 — UI 미사용, 며칠 모아서 Yahoo 값과 일치성 확인용.
    alt: {
      fx: altFx,
      crypto: altBtc,
      yahoo: {
        usdKrw: yahooKrwVal,
        btcUsd: yahooBtcVal,
      },
    },
  };

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`[fetch] wrote ${OUTPUT}`);
  console.log(
    `        US snapshot: ${usSnapshot.length} | ticker: ${ticker.length} | KR base: ${kr?.available ? 'on' : 'off'} | KR top12: ${krTop12.filter((c) => c.available).length}/${krTop12.length} | US top12: ${usTop12.filter((c) => c.available).length}/${usTop12.length}`,
  );
  console.log(
    `        alt: frankfurter=${altFx ? 'ok' : 'fail'} coingecko=${altBtc ? 'ok' : 'fail'}`,
  );
}

main().catch((err) => {
  console.error('[fetch] failed:', err);
  process.exit(1);
});
