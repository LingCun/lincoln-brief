#!/usr/bin/env node
/**
 * 매일 아침 데일리 브리프 글을 마크다운으로 자동 생성.
 * - src/data/market-snapshot.json 을 읽어 글 채움
 * - public/thumbnails/daily-brief-YYYYMMDD.svg 도 함께 생성
 *
 * 본문은 데이터에서 자동 추출된 사실만 채우고,
 * 분석/해석 부분은 [TODO: Lincoln 검토] 마커로 남깁니다.
 * 이는 의도된 설계 — 사실은 자동화하되, 통찰은 사람이 채우는 구조.
 *
 * Usage: node scripts/generate-daily-brief.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'src/data/market-snapshot.json');
const POSTS_DIR = path.join(ROOT, 'src/content/blog');
const THUMBS_DIR = path.join(ROOT, 'public/thumbnails');

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; }
function isoDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

async function main() {
  const data = JSON.parse(await fs.readFile(DATA, 'utf8'));
  const today = new Date();
  const stamp = ymd(today);
  const slug = `daily-brief-${stamp}`;
  const monthDay = `${today.getMonth() + 1}월 ${today.getDate()}일`;

  // Find S&P, NASDAQ, NVDA for headline
  const sp = data.snapshot.find((s) => s.label === 'S&P 500');
  const ndx = data.snapshot.find((s) => s.label === 'NASDAQ');
  const dow = data.snapshot.find((s) => s.label === 'DOW');
  const nvda = data.snapshot.find((s) => s.label === 'NVDA');

  const f = (n, d = 2) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const p = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

  const md = `---
title: "${monthDay} 시장 브리핑 — ${sp ? `S&P ${p(sp.changePct)}` : ''}"
description: "${data.asOfLabel} 기준 미국 3대 지수 마감 + 한국 개장 관전 포인트. 자동 생성 후 Lincoln 검토 발행."
pubDate: ${isoDate(today)}
thumbnail: /thumbnails/${slug}.svg
category: daily-brief
tags: ["시황", "S&P500", "NASDAQ", "DOW"]
readMinutes: 4
sources:
  - label: "Yahoo Finance"
    url: "https://finance.yahoo.com/"
---

> 한 줄 요약 — [TODO: Lincoln 검토] 오늘 시장이 무엇을 말했는지 한 문장으로.

## 미국 마감 (${data.asOfLabel})

| 지수 | 종가 | 변동 |
|---|---|---|
${sp  ? `| S&P 500   | **${f(sp.close)}**   | ${p(sp.changePct)} |\n` : ''}\
${ndx ? `| NASDAQ    | **${f(ndx.close)}**  | ${p(ndx.changePct)} |\n` : ''}\
${dow ? `| Dow Jones | ${f(dow.close)}      | ${p(dow.changePct)} |\n` : ''}\

**핵심 모먼트.** [TODO: Lincoln 검토] 오늘 시장을 끌고 간 한 가지 테마.

## 종목 — 그날의 주연

${nvda ? `- **엔비디아 (NVDA)** — $${f(nvda.close)} 마감, ${p(nvda.changePct)}.` : ''}
- [TODO: Lincoln 검토] 추가 주연 종목 3-5개

## 오늘 한국 관전 포인트

1. **반도체 동조 강도** — [TODO: Lincoln 검토]
2. **외국인 수급** — [TODO: Lincoln 검토]
3. **환율** — [TODO: Lincoln 검토]

## 시장은 무엇을 묻고 있나

[TODO: Lincoln 검토] 사실 위에 얹는 한 단락의 해석.

## 한 줄 정리

> [TODO: Lincoln 검토] 글 전체를 받쳐주는 한 줄.

— Lincoln
`;

  await fs.mkdir(POSTS_DIR, { recursive: true });
  const postPath = path.join(POSTS_DIR, `${slug}.md`);
  await fs.writeFile(postPath, md, 'utf8');
  console.log(`[generate] wrote ${postPath}`);

  // Generate thumbnail
  const thumbSvg = renderThumbnail(today, sp, ndx, dow, nvda, f, p);
  await fs.mkdir(THUMBS_DIR, { recursive: true });
  const thumbPath = path.join(THUMBS_DIR, `${slug}.svg`);
  await fs.writeFile(thumbPath, thumbSvg, 'utf8');
  console.log(`[generate] wrote ${thumbPath}`);

  console.log('\n[generate] draft post created with [TODO: Lincoln 검토] markers.');
  console.log('           Edit the file, remove markers, set featured: true, then commit.');
  console.log('\n[next] 사진 추가 시:');
  console.log('       1) public/thumbnails/photos/ 에 jpg 저장 + _ATTRIBUTION.md 기록');
  console.log('       2) SVG 의 <image href> 를 그 경로로 수정');
  console.log('       3) npm run inline:thumbnails  (사진을 base64 로 SVG 안에 인라인)');
}

function renderThumbnail(today, sp, ndx, dow, nvda, f, p) {
  const dateLabel = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
  const spClose = sp ? f(sp.close) : '—';
  const spPct = sp ? p(sp.changePct) : '';
  const spUp = sp ? sp.changePct >= 0 : true;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1510"/><stop offset="100%" stop-color="#0f0c08"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#f0d88c"/><stop offset="50%" stop-color="#d8b878"/><stop offset="100%" stop-color="#b89a5a"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#d8b878" stop-opacity="0.12"/><stop offset="100%" stop-color="#d8b878" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <circle cx="1000" cy="200" r="350" fill="url(#glow)"/>
  <line x1="80" y1="80" x2="200" y2="80" stroke="#d8b878" stroke-width="1"/>
  <text x="220" y="84" font-family="Georgia, serif" font-style="italic" font-size="20" fill="#f5edd9">Lincoln</text>
  <text x="310" y="84" font-family="Georgia, serif" font-size="12" letter-spacing="6" fill="#d8b878">BRIEF</text>
  <text x="80" y="200" font-family="monospace" font-size="13" letter-spacing="5" fill="#d8b878">— DAILY MARKET BRIEF —</text>
  <text x="80" y="290" font-family="Playfair Display, Georgia, serif" font-size="78" fill="#f5edd9">${today.getMonth() + 1}월 ${today.getDate()}일,</text>
  <text x="80" y="365" font-family="Playfair Display, Georgia, serif" font-size="78" font-style="italic" fill="url(#gold)">시장 브리핑</text>
  <text x="80" y="540" font-family="monospace" font-size="14" letter-spacing="4" fill="#988e72">S&amp;P 500 CLOSE</text>
  <text x="80" y="610" font-family="Playfair Display, Georgia, serif" font-size="80" font-weight="600" fill="#f5edd9" id="sp-close">${spClose}</text>
  <!-- Arrow + change positioned with generous offset to avoid overlap. Width approximation: each digit/dot/comma ≈ 38–48px at fontSize 80 in Playfair. -->
  <g transform="translate(${80 + Math.max(spClose.length * 44, 420)}, 0)">
    ${spUp
      ? '<polygon points="0,590 20,590 10,572" fill="#d96552"/>'
      : '<polygon points="0,572 20,572 10,590" fill="#5677b0"/>'}
    <text x="35" y="610" font-family="Playfair Display, Georgia, serif" font-size="40" font-weight="500" fill="${spUp ? '#d96552' : '#5677b0'}">${spPct}</text>
  </g>
  <line x1="80" y1="660" x2="1200" y2="660" stroke="#3d3326" stroke-width="1"/>
  <text x="80" y="685" font-family="monospace" font-size="11" letter-spacing="3" fill="#988e72">${dateLabel} · 06:00 KST</text>
</svg>
`;
}

main().catch((err) => {
  console.error('[generate] failed:', err);
  process.exit(1);
});
