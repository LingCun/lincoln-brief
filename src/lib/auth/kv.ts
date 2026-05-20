import Redis from 'ioredis';

export interface KVClient {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, opts?: { ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
}

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL || process.env.KV_URL;
  if (!url) {
    throw new Error('REDIS_URL (or KV_URL) is not configured');
  }
  _redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: false });
  return _redis;
}

export function createVercelKV(): KVClient {
  return {
    async get<T>(key: string): Promise<T | null> {
      const raw = await getRedis().get(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    },
    async set<T>(key, value, opts) {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      if (opts?.ex) {
        await getRedis().set(key, serialized, 'EX', opts.ex);
      } else {
        await getRedis().set(key, serialized);
      }
    },
    async del(key) {
      await getRedis().del(key);
    },
    async incr(key) {
      return await getRedis().incr(key);
    },
    async expire(key, seconds) {
      await getRedis().expire(key, seconds);
    },
  };
}

interface MemoryEntry {
  value: unknown;
  expiresAt: number | null;
}

export interface MemoryKV extends KVClient {
  __advanceClock(ms: number): void;
  __reset(): void;
}

export function createMemoryKV(): MemoryKV {
  const store = new Map<string, MemoryEntry>();
  let now = Date.now();

  const isExpired = (entry: MemoryEntry) =>
    entry.expiresAt !== null && entry.expiresAt <= now;

  const getEntry = (key: string): MemoryEntry | null => {
    const entry = store.get(key);
    if (!entry) return null;
    if (isExpired(entry)) {
      store.delete(key);
      return null;
    }
    return entry;
  };

  return {
    async get<T>(key: string): Promise<T | null> {
      const entry = getEntry(key);
      return entry ? (entry.value as T) : null;
    },
    async set(key, value, opts) {
      const expiresAt = opts?.ex ? now + opts.ex * 1000 : null;
      store.set(key, { value, expiresAt });
    },
    async del(key) {
      store.delete(key);
    },
    async incr(key) {
      const entry = getEntry(key);
      const next = (typeof entry?.value === 'number' ? entry.value : 0) + 1;
      store.set(key, { value: next, expiresAt: entry?.expiresAt ?? null });
      return next;
    },
    async expire(key, seconds) {
      const entry = store.get(key);
      if (entry) entry.expiresAt = now + seconds * 1000;
    },
    __advanceClock(ms) {
      now += ms;
    },
    __reset() {
      store.clear();
      now = Date.now();
    },
  };
}
