// Day-0 spike (revised): D1 — Google Gemini SDK on GitHub Actions runner.
// D2 (PlayMCP) 는 cron 부적합으로 CLOSED — 이번 spike 에서 제거.
// 참조: docs/superpowers/specs/2026-05-20-lincoln-brief-mcp-pipeline-scope-v2.md
//
// 사용:
//   1) npm install --no-save @google/generative-ai  (워크플로에서 자동 설치)
//   2) GEMINI_API_KEY=... node scripts/spike-d1-d2.mjs
//
// 목적: 구현 (WP-1 ~ WP-9) 진입 전, Gemini Free Tier 환경 호환성 검증.
// 결과는 stdout 으로만 보고. 파일 생성 / 커밋 없음.

const ok = (msg) => console.log(`PASS  ${msg}`);
const fail = (msg) => console.log(`FAIL  ${msg}`);
const info = (msg) => console.log(`INFO  ${msg}`);
const section = (title) => console.log(`\n========== ${title} ==========`);

let d1Result = 'PENDING';

// ---------- D1: Google Gemini SDK ↔ Actions runner ----------
section('D1: Google Gemini SDK on Node 22 runner');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  fail('GEMINI_API_KEY 가 환경에 없음 — GitHub repo Settings → Secrets 에 등록 후 워크플로 수동 재실행 필요.');
  d1Result = 'BLOCKED_NO_KEY';
} else {
  info(`Node 버전: ${process.version}`);
  info(`Platform: ${process.platform}`);

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    ok('@google/generative-ai import 성공');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const t0 = Date.now();
    const result = await model.generateContent('Reply with exactly: "hi from runner"');
    const ms = Date.now() - t0;

    const text = result.response.text();
    const usage = result.response.usageMetadata;
    ok(`generateContent 왕복 ${ms}ms — usage in=${usage?.promptTokenCount} out=${usage?.candidatesTokenCount}`);
    info(`응답 본문: ${JSON.stringify(text)}`);
    d1Result = 'PASS';
  } catch (e) {
    fail(`Gemini SDK 호출 실패: ${e?.message ?? e}`);
    if (e?.status) info(`HTTP status: ${e.status}`);
    if (e?.errorDetails) info(`Error details: ${JSON.stringify(e.errorDetails)}`);
    if (e?.name) info(`Error name: ${e.name}`);
    d1Result = 'FAIL';
  }
}

// ---------- 결과 요약 ----------
section('SUMMARY');
console.log(`D1 (Gemini SDK on runner): ${d1Result}`);
console.log(`D2 (PlayMCP)             : CLOSED — 사용 안 함 (PM v2 결정)`);

if (d1Result !== 'PASS') process.exitCode = 1;
