import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryKV } from '../../../src/lib/auth/kv';
import {
  issueMagicLinkToken,
  consumeMagicLinkToken,
  MAGIC_LINK_TTL_SECONDS,
} from '../../../src/lib/auth/magic-link';

describe('magic-link', () => {
  let kv: ReturnType<typeof createMemoryKV>;

  beforeEach(() => {
    kv = createMemoryKV();
  });

  it('issueMagicLinkToken 은 토큰 반환', async () => {
    const token = await issueMagicLinkToken(kv, 'user@example.com');
    expect(token).toMatch(/^[A-Za-z0-9_-]{20,}$/);
  });

  it('consumeMagicLinkToken 은 유효한 토큰이면 email 반환', async () => {
    const token = await issueMagicLinkToken(kv, 'user@example.com');
    expect(await consumeMagicLinkToken(kv, token)).toBe('user@example.com');
  });

  it('consumeMagicLinkToken 후 같은 토큰 재사용 시 null (1회용)', async () => {
    const token = await issueMagicLinkToken(kv, 'user@example.com');
    await consumeMagicLinkToken(kv, token);
    expect(await consumeMagicLinkToken(kv, token)).toBeNull();
  });

  it('없는 토큰은 null', async () => {
    expect(await consumeMagicLinkToken(kv, 'nonexistent')).toBeNull();
  });

  it('만료된 토큰은 null', async () => {
    const token = await issueMagicLinkToken(kv, 'user@example.com');
    kv.__advanceClock((MAGIC_LINK_TTL_SECONDS + 1) * 1000);
    expect(await consumeMagicLinkToken(kv, token)).toBeNull();
  });

  it('MAGIC_LINK_TTL_SECONDS 는 15분', () => {
    expect(MAGIC_LINK_TTL_SECONDS).toBe(15 * 60);
  });
});
