import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryKV } from '../../../src/lib/auth/kv';

describe('createMemoryKV (테스트 더블)', () => {
  let kv: ReturnType<typeof createMemoryKV>;

  beforeEach(() => {
    kv = createMemoryKV();
  });

  it('set/get 왕복', async () => {
    await kv.set('foo', { a: 1 });
    expect(await kv.get('foo')).toEqual({ a: 1 });
  });

  it('없는 키는 null', async () => {
    expect(await kv.get('missing')).toBeNull();
  });

  it('delete 후 get 은 null', async () => {
    await kv.set('foo', 'bar');
    await kv.del('foo');
    expect(await kv.get('foo')).toBeNull();
  });

  it('expireSeconds 지정 시 시간 경과 후 null', async () => {
    await kv.set('foo', 'bar', { ex: 1 });
    expect(await kv.get('foo')).toBe('bar');
    kv.__advanceClock(1500);
    expect(await kv.get('foo')).toBeNull();
  });

  it('incr 는 1씩 증가 (없는 키는 1)', async () => {
    expect(await kv.incr('counter')).toBe(1);
    expect(await kv.incr('counter')).toBe(2);
    expect(await kv.incr('counter')).toBe(3);
  });

  it('incr 후 ex 가 있으면 만료', async () => {
    await kv.incr('counter');
    await kv.expire('counter', 1);
    expect(await kv.get('counter')).toBe(1);
    kv.__advanceClock(1500);
    expect(await kv.get('counter')).toBeNull();
  });
});
