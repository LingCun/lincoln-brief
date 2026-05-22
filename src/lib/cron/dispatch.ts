// External cron (cron-job.org) → GitHub Actions workflow_dispatch bridge.
// GHA schedule cron 신뢰성이 낮아서 (지연/드롭 빈발) 외부 cron 이 본 endpoint 를 hit →
// 여기서 GitHub API 로 워크플로 발사. GHA 의 schedule 트리거는 belt-and-suspenders 로 유지.

type WorkflowDispatch = {
  workflow: string;
  inputs?: Record<string, string>;
};

// Allowlist. 외부 cron 이 임의 워크플로 발사 못 하게 job 이름 → 워크플로 매핑 고정.
export const ALLOWED_JOBS: Record<string, WorkflowDispatch> = {
  'refresh-market': { workflow: 'refresh-market.yml' },
  'us-prep-01': { workflow: 'us-daily-prep.yml', inputs: { slot: '01' } },
  'us-prep-06': { workflow: 'us-daily-prep.yml', inputs: { slot: '06' } },
  'kr-prep-11': { workflow: 'kr-daily-prep.yml', inputs: { slot: '11' } },
  'kr-prep-16': { workflow: 'kr-daily-prep.yml', inputs: { slot: '16' } },
  'watchdog-us-01': { workflow: 'watchdog.yml', inputs: { market: 'us', slot: '01' } },
  'watchdog-us-06': { workflow: 'watchdog.yml', inputs: { market: 'us', slot: '06' } },
  'watchdog-kr-11': { workflow: 'watchdog.yml', inputs: { market: 'kr', slot: '11' } },
  'watchdog-kr-16': { workflow: 'watchdog.yml', inputs: { market: 'kr', slot: '16' } },
};

const GITHUB_OWNER = 'LingCun';
const GITHUB_REPO = 'lincoln-brief';

export type DispatchResult =
  | { ok: true }
  | { ok: false; status: number; body: string };

export async function dispatchWorkflow(
  job: WorkflowDispatch,
  token: string,
): Promise<DispatchResult> {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${job.workflow}/dispatches`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'lincoln-brief-cron-bridge',
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: job.inputs ?? {},
    }),
  });
  if (res.status === 204) return { ok: true };
  return { ok: false, status: res.status, body: await res.text() };
}
