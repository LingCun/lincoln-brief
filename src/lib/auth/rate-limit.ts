import type { KVClient } from './kv';

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
}

export async function rateLimit(kv: KVClient, opts: RateLimitOptions): Promise<RateLimitResult> {
  const k = `ratelimit:${opts.key}`;
  const count = await kv.incr(k);
  if (count === 1) {
    await kv.expire(k, opts.windowSeconds);
  }
  const remaining = Math.max(0, opts.limit - count);
  return {
    ok: count <= opts.limit,
    remaining,
  };
}
