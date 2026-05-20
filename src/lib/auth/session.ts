import { nanoid } from 'nanoid';
import type { KVClient } from './kv';

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30일
export const SESSION_COOKIE_NAME = 'lb_session';

export interface SessionData {
  email: string;
}

export async function createSession(kv: KVClient, email: string): Promise<string> {
  const sid = nanoid(32);
  await kv.set(`session:${sid}`, { email }, { ex: SESSION_TTL_SECONDS });
  return sid;
}

export async function getSession(kv: KVClient, sid: string): Promise<SessionData | null> {
  return await kv.get<SessionData>(`session:${sid}`);
}

export async function destroySession(kv: KVClient, sid: string): Promise<void> {
  await kv.del(`session:${sid}`);
}

export function sessionCookieAttributes(): string {
  return [
    `Path=/`,
    `HttpOnly`,
    `Secure`,
    `SameSite=Lax`,
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ].join('; ');
}

export function clearSessionCookieAttributes(): string {
  return [`Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Max-Age=0`].join('; ');
}
