// Day-0 spike (revised v3): D1 — Groq Free Tier on GitHub Actions runner.
// D2 (PlayMCP) 는 cron 부적합으로 CLOSED.
// 참조: docs/superpowers/specs/2026-05-20-lincoln-brief-mcp-pipeline-scope-v2.md
//
// 사용:
//   1) npm install --no-save groq-sdk  (워크플로에서 자동 설치)
//   2) GROQ_API_KEY=... node scripts/spike-d1-d2.mjs
//
// 목적: 구현 진입 전, Groq Free Tier (Llama 3.3 70B) 환경 호환성 + 한국어 품질 1차 검증.
// 결과는 stdout 으로만 보고. 파일 생성 / 커밋 없음.

const ok = (msg) => console.log(`PASS  ${msg}`);
const fail = (msg) => console.log(`FAIL  ${msg}`);
const info = (msg) => console.log(`INFO  ${msg}`);
const section = (title) => console.log(`\n========== ${title} ==========`);

let d1Result = 'PENDING';

// ---------- D1: Groq SDK ↔ Actions runner + 한국어 품질 1차 확인 ----------
section('D1: Groq Free Tier on Node 22 runner + 한국어 응답 품질');

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  fail('GROQ_API_KEY 가 환경에 없음 — https://console.groq.com/keys 에서 발급 후 GitHub repo Settings → Secrets 에 등록 필요.');
  d1Result = 'BLOCKED_NO_KEY';
} else {
  info(`Node 버전: ${process.version}`);
  info(`Platform: ${process.platform}`);

  try {
    const { default: Groq } = await import('groq-sdk');
    ok('groq-sdk import 성공');

    const client = new Groq({ apiKey });

    const t0 = Date.now();
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: '당신은 한국어 시장 브리핑 블로그의 보조 작가입니다. 모든 응답은 자연스러운 한국어로 작성합니다.',
        },
        {
          role: 'user',
          content: '다음 한국어 시장 데이터를 한 문장으로 정리해주세요. 톤은 침착하고 분석적으로. 매수 추천 어휘는 금지.\n\nKOSPI 종가 7,271.66, 일변동 -3.25%. 외국인 4거래일 연속 순매도. 환율 1,508원 신고치 갱신.',
        },
      ],
      max_tokens: 200,
    });
    const ms = Date.now() - t0;

    const text = completion.choices?.[0]?.message?.content ?? '';
    const usage = completion.usage;
    ok(`chat.completions.create 왕복 ${ms}ms — usage in=${usage?.prompt_tokens} out=${usage?.completion_tokens}`);
    info(`한국어 응답 본문:\n  ${text.replace(/\n/g, '\n  ')}`);
    d1Result = 'PASS';
  } catch (e) {
    fail(`Groq SDK 호출 실패: ${e?.message ?? e}`);
    if (e?.status) info(`HTTP status: ${e.status}`);
    if (e?.error?.error?.type) info(`API error type: ${e.error.error.type}`);
    if (e?.error?.error?.message) info(`API error message: ${e.error.error.message}`);
    if (e?.name) info(`Error name: ${e.name}`);
    d1Result = 'FAIL';
  }
}

// ---------- 결과 요약 ----------
section('SUMMARY');
console.log(`D1 (Groq SDK on runner): ${d1Result}`);
console.log(`D2 (PlayMCP)           : CLOSED — 사용 안 함 (PM v2 결정)`);
console.log('');
console.log('한국어 품질 평가는 마스터님이 위 응답 본문을 보고 결정 (Lincoln 톤과 일치하는가).');

if (d1Result !== 'PASS') process.exitCode = 1;
