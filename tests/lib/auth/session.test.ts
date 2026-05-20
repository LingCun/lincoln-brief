import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryKV } from '../../../src/lib/auth/kv';
import {
  createSession,
  getSession,
  destroySession,
  SESSION_TTL_SECONDS,
} from '../../../src/lib/auth/session';

describe('session', () => {
  let kv: ReturnType<typeof createMemoryKV>;

  beforeEach(() => {
    kv = createMemoryKV();
  });

  it('createSession 은 sid 반환 + KV 에 저장', async () => {
    const sid = await createSession(kv, 'user@example.com');
    expect(sid).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(await kv.get(`session:${sid}`)).toEqual({ email: 'user@example.com' });
  });

  it('getSession 은 유효한 sid 면 user 반환', async () => {
    const sid = await createSession(kv, 'user@example.com');
    expect(await getSession(kv, sid)).toEqual({ email: 'user@example.com' });
  });

  it('getSession 은 없는 sid 면 null', async () => {
    expect(await getSession(kv, 'nonexistent')).toBeNull();
  });

  it('getSession 은 만료 후 null', async () => {
    const sid = await createSession(kv, 'user@example.com');
    kv.__advanceClock((SESSION_TTL_SECONDS + 1) * 1000);
    expect(await getSession(kv, sid)).toBeNull();
  });

  it('destroySession 후 getSession null', async () => {
    const sid = await createSession(kv, 'user@example.com');
    await destroySession(kv, sid);
    expect(await getSession(kv, sid)).toBeNull();
  });

  it('SESSION_TTL_SECONDS 는 30일', () => {
    expect(SESSION_TTL_SECONDS).toBe(30 * 24 * 60 * 60);
  });
});
