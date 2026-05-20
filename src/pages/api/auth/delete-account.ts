import type { APIRoute } from 'astro';
import { createVercelKV } from '../../../lib/auth/kv';
import {
  destroySession,
  getSession,
  SESSION_COOKIE_NAME,
  clearSessionCookieAttributes,
} from '../../../lib/auth/session';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  const sid = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sid) {
    return new Response(null, { status: 302, headers: { Location: '/' } });
  }
  const kv = createVercelKV();
  const session = await getSession(kv, sid);
  if (session) {
    await kv.del(`users:${session.email}`);
  }
  await destroySession(kv, sid);
  return new Response(null, {
    status: 302,
    headers: {
      'Set-Cookie': `${SESSION_COOKIE_NAME}=; ${clearSessionCookieAttributes()}`,
      Location: '/?deleted=1',
    },
  });
};
