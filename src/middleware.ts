import { defineMiddleware } from 'astro:middleware';
import { createVercelKV } from './lib/auth/kv';
import { getSession, SESSION_COOKIE_NAME } from './lib/auth/session';

// hybrid 모드에선 prerender 페이지 빌드 시에도 미들웨어가 실행됨.
// cookies.get() 이 내부적으로 request.headers.get('cookie') 를 시도 → prerender 컨텍스트에서
// `Astro.request.headers is unavailable in "static" output mode` WARN 4건 발사 (카테고리 페이지마다).
// 세션이 실제 필요한 경로 (/account, /keystatic) 에서만 cookies 조회해서 빌드 노이즈 제거.
const AUTH_REQUIRED_PREFIXES = ['/account', '/keystatic', '/api'];

export const onRequest = defineMiddleware(async ({ cookies, locals, url }, next) => {
  locals.user = null;
  const needsAuth = AUTH_REQUIRED_PREFIXES.some((p) => url.pathname.startsWith(p));
  if (!needsAuth) return next();

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
