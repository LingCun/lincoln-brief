import { defineMiddleware } from 'astro:middleware';
import { createVercelKV } from './lib/auth/kv';
import { getSession, SESSION_COOKIE_NAME } from './lib/auth/session';

export const onRequest = defineMiddleware(async ({ cookies, locals }, next) => {
  locals.user = null;
  const sid = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sid) {
    try {
      const kv = createVercelKV();
      const session = await getSession(kv, sid);
      if (session) {
        locals.user = { email: session.email };
      }
    } catch (err) {
      console.error('[middleware] session check failed:', err);
    }
  }
  return next();
});
