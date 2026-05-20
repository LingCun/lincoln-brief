import type { APIRoute } from 'astro';
import { createVercelKV } from '../../../lib/auth/kv';
import { consumeMagicLinkToken } from '../../../lib/auth/magic-link';
import {
  createSession,
  SESSION_COOKIE_NAME,
  sessionCookieAttributes,
} from '../../../lib/auth/session';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');
  const nextParam = url.searchParams.get('next') ?? '/';

  if (!token) {
    return errorRedirect('missing_token');
  }

  const kv = createVercelKV();
  const email = await consumeMagicLinkToken(kv, token);
  if (!email) {
    return errorRedirect('invalid_or_expired');
  }

  await kv.set(`users:${email}`, { email, lastSeenAt: Date.now() });
  const sid = await createSession(kv, email);

  const safeNext = nextParam.startsWith('/') && !nextParam.startsWith('//')
    ? nextParam
    : '/';

  return new Response(null, {
    status: 302,
    headers: {
      'Set-Cookie': `${SESSION_COOKIE_NAME}=${sid}; ${sessionCookieAttributes()}`,
      Location: safeNext,
    },
  });
};

function errorRedirect(reason: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: `/login?error=${encodeURIComponent(reason)}` },
  });
}
