import type { APIRoute } from 'astro';
import { ALLOWED_JOBS, dispatchWorkflow } from '../../../lib/cron/dispatch';

export const prerender = false;

const CRON_SECRET = import.meta.env.CRON_SECRET;
const GH_TOKEN = import.meta.env.GH_DISPATCH_TOKEN;

const handler: APIRoute = async ({ request, url }) => {
  const auth = request.headers.get('authorization');
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!GH_TOKEN) {
    return new Response('Server misconfigured: GH_DISPATCH_TOKEN missing', { status: 500 });
  }

  const jobName = url.searchParams.get('job');
  if (!jobName || !(jobName in ALLOWED_JOBS)) {
    const allowed = Object.keys(ALLOWED_JOBS).join(', ');
    return new Response(`Unknown job: ${jobName}. Allowed: ${allowed}`, { status: 400 });
  }

  const result = await dispatchWorkflow(ALLOWED_JOBS[jobName], GH_TOKEN);
  if (result.ok) {
    return new Response(`Dispatched ${jobName}`, { status: 200 });
  }
  return new Response(
    `GitHub API error: ${result.status} ${result.body}`,
    { status: 502 },
  );
};

export const GET = handler;
export const POST = handler;
