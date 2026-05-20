import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryKV } from '../../../src/lib/auth/kv';
import { rateLimit } from '../../../src/lib/auth/rate-limit';

describe('rateLimit', () => {
  let kv: ReturnType<typeof createMemoryKV>;

  beforeEach(() => {
    kv = createMemoryKV();
  });

  it('한도 이내면 ok: true + remaining 반환', async () => {
    const result = await rateLimit(kv, { key: 'ip:1.2.3.4', limit: 5, windowSeconds: 60 });
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('호출마다 remaining 감소', async () => {
    for (let i = 0; i < 5; i++) {
      const result = await rateLimit(kv, { key: 'ip:1.2.3.4', limit: 5, windowSeconds: 60 });
      expect(result.ok).toBe(true);
      expect(result.remaining).toBe(4 - i);
    }
  });

  it('한도 초과 시 ok: false', async () => {
    for (let i = 0; i < 5; i++) {
      await rateLimit(kv, { key: 'ip:1.2.3.4', limit: 5, windowSeconds: 60 });
    }
    const result = await rateLimit(kv, { key: 'ip:1.2.3.4', limit: 5, windowSeconds: 60 });
    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('윈도우 경과 후 리셋', async () => {
    for (let i = 0; i < 5; i++) {
      await rateLimit(kv, { key: 'ip:1.2.3.4', limit: 5, windowSeconds: 60 });
    }
    kv.__advanceClock(60_000 + 1000);
    const result = await rateLimit(kv, { key: 'ip:1.2.3.4', limit: 5, windowSeconds: 60 });
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('서로 다른 key 는 독립적', async () => {
    for (let i = 0; i < 5; i++) {
      await rateLimit(kv, { key: 'ip:1.1.1.1', limit: 5, windowSeconds: 60 });
    }
    const otherIp = await rateLimit(kv, { key: 'ip:2.2.2.2', limit: 5, windowSeconds: 60 });
    expect(otherIp.ok).toBe(true);
    expect(otherIp.remaining).toBe(4);
  });
});
