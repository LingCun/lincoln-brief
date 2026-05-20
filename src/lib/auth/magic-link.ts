import { nanoid } from 'nanoid';
import type { KVClient } from './kv';

export const MAGIC_LINK_TTL_SECONDS = 15 * 60; // 15분

interface MagicLinkPayload {
  email: string;
}

export async function issueMagicLinkToken(kv: KVClient, email: string): Promise<string> {
  const token = nanoid(32);
  await kv.set(`magic-link:${token}`, { email }, { ex: MAGIC_LINK_TTL_SECONDS });
  return token;
}

export async function consumeMagicLinkToken(kv: KVClient, token: string): Promise<string | null> {
  const payload = await kv.get<MagicLinkPayload>(`magic-link:${token}`);
  if (!payload) return null;
  await kv.del(`magic-link:${token}`);
  return payload.email;
}
