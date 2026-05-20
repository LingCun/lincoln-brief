import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { createVercelKV } from '../../../lib/auth/kv';
import { issueMagicLinkToken, MAGIC_LINK_TTL_SECONDS } from '../../../lib/auth/magic-link';
import { rateLimit } from '../../../lib/auth/rate-limit';
import { loginEmailHtml, loginEmailText } from '../../../lib/auth/email-template';

export const prerender = false;

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: { email?: string; next?: string };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const next = typeof body.next === 'string' ? body.next : '/';

  if (!EMAIL_REGEX.test(email)) {
    return json({ ok: false, error: 'invalid_email' }, 400);
  }

  const kv = createVercelKV();

  const ipLimit = await rateLimit(kv, {
    key: `magic-link-ip:${clientAddress ?? 'unknown'}`,
    limit: 5,
    windowSeconds: 60,
  });
  if (!ipLimit.ok) {
    return json({ ok: false, error: 'rate_limited' }, 429);
  }

  const emailLimit = await rateLimit(kv, {
    key: `magic-link-email:${email}`,
    limit: 3,
    windowSeconds: 3600,
  });
  if (!emailLimit.ok) {
    return json({ ok: true });
  }

  const token = await issueMagicLinkToken(kv, email);
  const siteUrl = import.meta.env.SITE_URL ?? 'http://localhost:4321';
  const loginUrl = `${siteUrl}/api/auth/verify?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;

  const resend = new Resend(import.meta.env.RESEND_API_KEY);
  const mailFrom = import.meta.env.MAIL_FROM ?? 'Lincoln Brief <onboarding@resend.dev>';

  try {
    await resend.emails.send({
      from: mailFrom,
      to: email,
      subject: 'Lincoln Brief 로그인 링크',
      text: loginEmailText({ loginUrl, expiresInMinutes: MAGIC_LINK_TTL_SECONDS / 60 }),
      html: loginEmailHtml({ loginUrl, expiresInMinutes: MAGIC_LINK_TTL_SECONDS / 60 }),
    });
  } catch (err) {
    console.error('[magic-link] resend send failed:', err);
    return json({ ok: true });
  }

  return json({ ok: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
