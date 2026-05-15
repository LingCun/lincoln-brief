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
// 미국 + 글로벌 (Yahoo Finance)
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
// Main
// ============================================================
async function main() {
  console.log('[fetch] starting market data fetch…');

  const [usSnapshot, ticker, kr] = await Promise.all([
    fetchUS(),
    fetchTicker(),
    fetchKorea(),
  ]);

  // 안전 가드: 모든 외부 호출 실패 (Yahoo 429 throttle 등) 시 기존 JSON 보존.
  // 스냅샷이 비어있는데 덮어쓰면 홈페이지가 빈 상태로 표시됨.
  const allEmpty = usSnapshot.length === 0 && ticker.length === 0 && (!kr || !kr.available);
  if (allEmpty) {
    console.error('[fetch] all sources empty (likely Yahoo throttle / network). Preserving existing snapshot.');
    process.exit(2);
  }

  const now = new Date();
  const out = {
    asOf: now.toISOString(),
    asOfLabel: `${now.getMonth() + 1}/${now.getDate()} 한국·미국 마감`,
    source: kr?.available ? 'Yahoo Finance · KRX' : 'Yahoo Finance',
    us: { snapshot: usSnapshot },
    kr: kr ?? {
      available: false,
      note: 'KRX_API_KEY 미설정 + Yahoo 폴백 실패.',
      snapshot: [
        { symbol: 'KOSPI',  label: 'KOSPI',   close: null, change: null, changePct: null, note: '데이터 대기' },
        { symbol: 'KOSDAQ', label: 'KOSDAQ',  close: null, change: null, changePct: null, note: '데이터 대기' },
        { symbol: 'USDKRW', label: 'USD/KRW', close: null, change: null, changePct: null, note: '데이터 대기' },
      ],
    },
    // Backwards compat (older components read top-level snapshot)
    snapshot: usSnapshot,
    ticker,
  };

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`[fetch] wrote ${OUTPUT}`);
  console.log(`        US snapshot: ${usSnapshot.length} | ticker: ${ticker.length} | KR: ${kr?.available ? 'on' : 'off'}`);
}

main().catch((err) => {
  console.error('[fetch] failed:', err);
  process.exit(1);
});
