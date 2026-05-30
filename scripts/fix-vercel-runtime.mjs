// Vercel serverless 함수 런타임을 강제로 nodejs20.x 로 고정한다.
//
// 왜 필요한가:
//   @astrojs/vercel@7 의 런타임 매핑은 Node 18·20 만 알고 있다. 빌드를 Node 22
//   (저장소 CI 기본값·요즘 Vercel 기본 빌드 이미지) 에서 돌리면 어댑터가 22 를
//   인식 못 해 함수 런타임을 'nodejs18.x' 로 조용히 폴백한다 (빌드 로그에 WARN).
//   nodejs18.x 는 Vercel 이 2025-09-01 폐기 → 배포 시 "invalid Node.js Version 18.x"
//   로 실패한다.
//
//   어댑터 v8 은 astro@^5 를 요구해 Astro 4.16 핀과 충돌하므로 업그레이드 대신,
//   빌드 산출물 (Build Output API v3 의 .vc-config.json) 의 runtime 필드를
//   배포 가능한 nodejs20.x (engines.node="20.x" 와 일치, Vercel 현재 지원) 로
//   덮어쓴다. 빌드 Node 가 20 이든 22 든 결과가 동일해진다. Idempotent.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const TARGET_RUNTIME = 'nodejs20.x';
const FUNCTIONS_DIR = '.vercel/output/functions';

// .vc-config.json 을 디렉터리 트리에서 모두 찾는다 (Node 20 에 없는 fs.glob 미사용).
async function findConfigs(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return []; // FUNCTIONS_DIR 부재 = astro build 미실행
  }
  const found = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await findConfigs(full)));
    } else if (entry.name === '.vc-config.json') {
      found.push(full);
    }
  }
  return found;
}

const configs = await findConfigs(FUNCTIONS_DIR);

let patched = 0;
let alreadyOk = 0;

for (const file of configs) {
  const config = JSON.parse(await readFile(file, 'utf8'));
  if (!('runtime' in config)) continue; // edge/static 함수 등 — 건드리지 않음
  if (config.runtime === TARGET_RUNTIME) {
    alreadyOk += 1;
    continue;
  }
  const previous = config.runtime;
  config.runtime = TARGET_RUNTIME;
  await writeFile(file, JSON.stringify(config, null, '\t') + '\n');
  console.log(`[fix-vercel-runtime] ${file}: ${previous} -> ${TARGET_RUNTIME}`);
  patched += 1;
}

if (configs.length === 0) {
  console.warn(
    '[fix-vercel-runtime] .vc-config.json 을 못 찾음 — astro build 가 먼저 실행됐는지 확인.',
  );
} else {
  console.log(
    `[fix-vercel-runtime] 완료: ${patched}개 패치, ${alreadyOk}개 이미 ${TARGET_RUNTIME}.`,
  );
}
