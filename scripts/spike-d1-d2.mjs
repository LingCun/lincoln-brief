// Day-0 spike: D1 (Claude SDK on GitHub Actions) + D2 (PlayMCP in SDK env)
// 참조: docs/superpowers/specs/2026-05-20-lincoln-brief-mcp-pipeline-wbs.md "5. 의존성·차단 요인"
//
// 사용:
//   1) npm i -D @anthropic-ai/sdk  (워크플로에서 자동 설치)
//   2) ANTHROPIC_API_KEY=sk-...  node scripts/spike-d1-d2.mjs
//
// 목적: 구현 (WP-1 ~ WP-9) 진입 전, 환경 호환성만 검증한다.
// 결과는 stdout 으로만 보고. 파일 생성 / 커밋 없음.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const ok = (msg) => console.log(`PASS  ${msg}`);
const warn = (msg) => console.log(`WARN  ${msg}`);
const fail = (msg) => console.log(`FAIL  ${msg}`);
const info = (msg) => console.log(`INFO  ${msg}`);
const section = (title) => console.log(`\n========== ${title} ==========`);

let d1Result = 'PENDING';
let d2Result = 'PENDING';

// ---------- D1: Claude Agent SDK ↔ Actions runner ----------
section('D1: Anthropic SDK on Node 22 runner');

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  fail('ANTHROPIC_API_KEY 가 환경에 없음 — GitHub repo Settings → Secrets 에 등록 후 워크플로 수동 재실행 필요.');
  d1Result = 'BLOCKED_NO_KEY';
} else {
  info(`Node 버전: ${process.version}`);
  info(`Platform: ${process.platform}`);

  try {
    const mod = await import('@anthropic-ai/sdk');
    const Anthropic = mod.default;
    ok('@anthropic-ai/sdk import 성공');

    const client = new Anthropic({ apiKey });

    const t0 = Date.now();
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',  // 단가 가벼운 sonnet 으로 핑
      max_tokens: 32,
      messages: [{ role: 'user', content: 'Reply with exactly: "hi from runner"' }],
    });
    const ms = Date.now() - t0;

    const text = msg.content?.[0]?.type === 'text' ? msg.content[0].text : '';
    ok(`messages.create 왕복 ${ms}ms — usage in=${msg.usage?.input_tokens} out=${msg.usage?.output_tokens}`);
    info(`응답 본문: ${JSON.stringify(text)}`);
    d1Result = 'PASS';
  } catch (e) {
    fail(`SDK 호출 실패: ${e?.message ?? e}`);
    if (e?.status) info(`HTTP status: ${e.status}`);
    d1Result = 'FAIL';
  }
}

// ---------- D2: PlayMCP in SDK environment ----------
section('D2: PlayMCP availability from SDK env (not Claude.ai client)');

// (a) .mcp.json 내용 확인
const mcpPath = join(repoRoot, '.mcp.json');
if (!existsSync(mcpPath)) {
  fail('.mcp.json 없음');
} else {
  const mcp = JSON.parse(readFileSync(mcpPath, 'utf8'));
  const servers = Object.keys(mcp.mcpServers ?? {});
  info(`.mcp.json 등록 서버: ${JSON.stringify(servers)}`);
  if (servers.includes('playmcp') || servers.includes('play-mcp')) {
    ok('.mcp.json 에 PlayMCP 등록 발견 — stdio 부팅 검증 필요');
  } else {
    warn('.mcp.json 에 PlayMCP 항목 없음. 현재 PlayMCP 도구는 Claude Code 클라이언트 세션 컨텍스트(=현재 이 spike 를 작성한 에이전트의 시스템 컨텍스트)에서만 접근 가능.');
  }
}

// (b) PlayMCP 의 호출 가능 경로 분석
//
// PlayMCP (https://claude.com/connectors/playmcp) 는 다음 사실들이 확인됨:
//  - Kakao 제공 "Connector" (= remote MCP, HTTP/SSE transport)
//  - Kakao 계정 OAuth 로 인증 (10분 one-time token 발급)
//  - "Claude 웹앱·데스크톱·모바일·Claude Code·Claude API" 라고 공식 표기
//  - Anthropic Messages API 의 "MCP connector" 기능 (mcp_servers 파라미터 + authorization_token)
//    으로 호출은 가능하나, OAuth 액세스 토큰은 호출자가 사전 발급해야 함
//
// GitHub Actions runner (= 헤드리스 환경) 에서의 사용성:
//  - OAuth 사용자 동의 화면을 띄울 브라우저가 없음
//  - 10분 만료 one-time token 은 cron 환경과 정합 안 됨 (매 실행마다 사람이 토큰 발급 불가)
//  - 따라서 PlayMCP 를 cron 워크플로에서 직접 호출하는 경로는 사실상 비현실적
//
// 결론: PlayMCP 는 "Claude.ai 사용자 세션 전용" 까지는 아니지만,
// "사람이 OAuth 흐름을 사전 통과해서 장기 토큰을 보관" 하는 인프라가 별도로 필요함.
// Lincoln Brief 의 cron 자동화엔 부적합. → PM 루프백 사유.

info('PlayMCP transport: remote (HTTP/SSE) via Claude Messages API "MCP connector" 파라미터');
info('PlayMCP auth: Kakao OAuth, 10분 one-time token 발급 방식');
info('헤드리스 Actions runner 에서는 OAuth 동의 + 토큰 갱신을 자동화하기 어려움');

// (c) 실제 도구 호출 시도 — authorization_token 이 없으면 시도 자체가 불가하므로 스킵
const playmcpToken = process.env.PLAYMCP_AUTHORIZATION_TOKEN;
if (!playmcpToken) {
  warn('PLAYMCP_AUTHORIZATION_TOKEN 환경변수 없음 — 도구 호출 시도 스킵.');
  warn('만약 PlayMCP 경로를 강행하려면 (1) Kakao OAuth 흐름을 별도 서비스로 구현, (2) refresh token 보관, (3) cron 직전 access token 발급 step 추가 가 필요.');
  d2Result = 'INFEASIBLE_FOR_CRON';
} else {
  // 참고용: Messages API + MCP connector 경로 호출 시도
  try {
    const mod = await import('@anthropic-ai/sdk');
    const Anthropic = mod.default;
    const client = new Anthropic({
      apiKey,
      defaultHeaders: { 'anthropic-beta': 'mcp-client-2025-04-04' },
    });
    const t0 = Date.now();
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 256,
      messages: [{ role: 'user', content: 'AAPL 현재가 알려줘' }],
      // @ts-expect-error beta param
      mcp_servers: [{
        type: 'url',
        url: 'https://playmcp.kakao.com/mcp',  // placeholder — 실제 URL 은 Kakao 측 문서에서 확인 필요
        name: 'playmcp',
        authorization_token: playmcpToken,
      }],
    });
    const ms = Date.now() - t0;
    ok(`PlayMCP via MCP connector 호출 성공 ${ms}ms`);
    info(JSON.stringify(msg.content).slice(0, 400));
    d2Result = 'PASS';
  } catch (e) {
    fail(`PlayMCP connector 호출 실패: ${e?.message ?? e}`);
    d2Result = 'FAIL';
  }
}

// ---------- 결과 요약 ----------
section('SUMMARY');
console.log(`D1 (Anthropic SDK on runner): ${d1Result}`);
console.log(`D2 (PlayMCP in cron env)    : ${d2Result}`);

if (d1Result !== 'PASS') process.exitCode = 1;
// D2 는 의도적으로 exit code 비반영 — 정보 수집 목적.
