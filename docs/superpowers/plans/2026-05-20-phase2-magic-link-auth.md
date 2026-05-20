# Phase 2: Magic Link 인증 + 세션 + /account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 1 의 게이팅 UI 위에 Magic Link 기반 인증·세션을 얹어 실제 로그인 사용자가 잠긴 글을 보고, /account 에서 자신을 관리하고, 탈퇴할 수 있게 함.

**Architecture:** Astro 4.16 hybrid 의 SSR 함수로 `/api/auth/*` 4개 엔드포인트와 `middleware.ts` 추가. Vercel KV (Upstash Redis) 가 토큰·세션·사용자 단일 저장소. Resend 가 트랜잭셔널 메일 발송. 세션은 random opaque 32B 토큰을 httpOnly 쿠키에 저장 (JWT 미사용). 잠금 카테고리 글에서 게이팅 판정은 Phase 1 의 `isLocked()` 그대로 사용하되, middleware 가 세션 존재 시 `Astro.locals.user` 채워서 [...slug].astro 분기가 통과시킴.

**Tech Stack:** Astro 4.16, `@vercel/kv`, `resend`, `nanoid`, Vitest, Node 20 (Vercel).

**Spec:** `docs/superpowers/specs/2026-05-20-subscription-gating-design.md` (§3-6, Phase 2 부분)

---

## File Structure

신규:
- `src/middleware.ts` — 세션 확인 + Astro.locals.user 주입
- `src/env.d.ts` 또는 기존 파일 수정 — `Astro.locals.user` 타입 선언
- `src/lib/auth/kv.ts` — Vercel KV 래퍼 (테스트 가능 인터페이스)
- `src/lib/auth/session.ts` — 세션 발급·검증·삭제
- `src/lib/auth/magic-link.ts` — 토큰 발급·검증·만료
- `src/lib/auth/email-template.ts` — 로그인 메일 본문
- `src/lib/auth/rate-limit.ts` — KV 카운터 기반 rate limit
- `src/pages/api/auth/magic-link.ts` — POST: 이메일 → 토큰 발급 + 메일 발송
- `src/pages/api/auth/verify.ts` — GET: 토큰 검증 + 세션 발급
- `src/pages/api/auth/logout.ts` — POST: 세션 삭제
- `src/pages/api/auth/delete-account.ts` — POST: 사용자 + 모든 세션 삭제
- `src/pages/login.astro` — 이미 회원인 사용자용 Magic Link 폼 단독
- `src/pages/account.astro` — 계정 설정 (이메일 + 로그아웃 + 탈퇴)
- `src/components/SubscribeForm.astro` — Magic Link 폼 (이메일 입력 + 안내 토글)
- `tests/lib/auth/session.test.ts`
- `tests/lib/auth/magic-link.test.ts`
- `tests/lib/auth/rate-limit.test.ts`

수정:
- `src/pages/subscribe.astro` — Stibee 버튼을 `<SubscribeForm />` 로 교체
- `src/pages/blog/[...slug].astro` — Astro.locals.user 있으면 게이팅 통과
- `src/components/Header.astro` — 우상단에 로그인/계정 링크 (작게)
- `package.json` — 의존성 추가
- `.env.example` — 신규 환경변수 키 안내 (값 비워둠)

---

## Task 0: 인프라 사전 준비 (수동 — 사용자 작업)

**이 task 는 코드 작업이 아닙니다. 사용자가 Vercel 대시보드 / Resend 대시보드에서 직접 수행한 뒤 환경변수를 채워야 후속 task 들이 작동합니다.**

**Files:** 없음 (외부 서비스 설정)

- [ ] **Step 0.1 — Vercel KV 인스턴스 생성**

1. https://vercel.com/dashboard → Lincoln Brief 프로젝트 → **Storage** 탭
2. **Create Database** → **KV** 선택 → 리전 = `iad1` 또는 가장 가까운 곳
3. 생성 후 자동으로 다음 환경변수가 프로젝트에 주입됨 (확인만 하면 됨):
   - `KV_URL`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`
4. **Settings → Environment Variables** 에서 위 4개가 Production·Preview·Development 모두 체크되어 있는지 확인.

- [ ] **Step 0.2 — Resend 계정 + 도메인 검증**

1. https://resend.com → 회원가입 (GitHub OAuth 가능)
2. **Domains** → **Add Domain** → 본인 발송 도메인 입력 (예: `lincoln-brief.com` 또는 `mail.lincoln-brief.com`). 도메인 없으면 Resend 가 제공하는 테스트 도메인 (`onboarding@resend.dev`) 으로 시작 가능 — 도착률은 낮음.
3. Resend 가 표시하는 DNS 레코드 (SPF, DKIM) 를 도메인 DNS 에 추가 (Cloudflare/Route53 등)
4. **Verify** 클릭 → 모든 레코드 ✓ 확인 (보통 5-30분 소요)
5. **API Keys** → **Create API Key** → 이름 `lincoln-brief-prod` → 권한 `Sending access` → 키 복사 (`re_...`)

- [ ] **Step 0.3 — Vercel 환경변수 등록**

Vercel **Settings → Environment Variables** 에서 다음 추가 (Production / Preview / Development 모두 체크):

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SITE_URL=https://lincoln-brief.vercel.app
MAIL_FROM=Lincoln Brief <hello@lincoln-brief.com>
```

> `MAIL_FROM` 의 도메인은 Step 0.2 에서 검증한 도메인이어야 함. 그렇지 않으면 발송 실패.
> Resend 테스트 도메인 사용 시 `MAIL_FROM=Lincoln Brief <onboarding@resend.dev>`.

- [ ] **Step 0.4 — 로컬 `.env` 동기화**

프로젝트 루트의 `.env` 에 같은 값을 복사 (`.env` 는 gitignored — 안전):

```bash
KV_URL=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...
RESEND_API_KEY=...
SITE_URL=http://localhost:4321
MAIL_FROM=Lincoln Brief <onboarding@resend.dev>
```

로컬 개발 시 `SITE_URL=http://localhost:4321`. `MAIL_FROM` 은 도메인 검증 없이도 `onboarding@resend.dev` 로 발송 가능 (도착률 낮으므로 실제 발송 테스트만).

- [ ] **Step 0.5 — `.env.example` 업데이트 (커밋)**

`.env.example` 파일에 신규 키 추가 (값은 비워둠):

```
# Vercel KV (자동 주입 — 로컬 .env 에는 Vercel 대시보드에서 복사)
KV_URL=
KV_REST_API_URL=
KV_REST_API_TOKEN=
KV_REST_API_READ_ONLY_TOKEN=

# Resend 트랜잭셔널 메일 (Magic Link 발송)
RESEND_API_KEY=
SITE_URL=http://localhost:4321
MAIL_FROM=Lincoln Brief <hello@example.com>
```

Commit:
```bash
git add .env.example
git commit -m "docs(env): Phase 2 Magic Link 인증 환경변수 키 추가"
```

> **이 task 가 완료되어야 Task 6 (POST /api/auth/magic-link) 부터 실제 메일이 발송됨.** Task 1-5 (헬퍼·테스트) 는 인프라 없어도 진행 가능.

---

## Task 1: 의존성 추가

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (자동)

- [ ] **Step 1: 의존성 설치**

```bash
npm install @vercel/kv resend nanoid
```

Expected: `package.json` 의 `dependencies` 에 `@vercel/kv`, `resend`, `nanoid` 추가됨.

- [ ] **Step 2: 빌드 통과 확인**

```bash
npm run build
```

Expected: 빌드 성공. 신규 의존성이 어디서도 사용 안 됨 → tree-shaking 으로 무시.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: @vercel/kv + resend + nanoid 추가 — Phase 2 인증 기반"
```

---

## Task 2: lib/auth/kv.ts — KV 래퍼 (TDD)

**목표:** 테스트 가능하도록 KV 클라이언트를 한 곳에서 import. 직접 `@vercel/kv` 를 다른 파일들이 import 하면 mock 어려움. 얇은 래퍼로 추상화.

**Files:**
- Create: `src/lib/auth/kv.ts`
- Create: `tests/lib/auth/kv.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/lib/auth/kv.test.ts`:

```typescript
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
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/lib/auth/kv.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: 구현**

`src/lib/auth/kv.ts`:

```typescript
import { kv as vercelKV } from '@vercel/kv';

export interface KVClient {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, opts?: { ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
}

export function createVercelKV(): KVClient {
  return {
    async get(key) {
      return (await vercelKV.get(key)) as any;
    },
    async set(key, value, opts) {
      if (opts?.ex) {
        await vercelKV.set(key, value as any, { ex: opts.ex });
      } else {
        await vercelKV.set(key, value as any);
      }
    },
    async del(key) {
      await vercelKV.del(key);
    },
    async incr(key) {
      return await vercelKV.incr(key);
    },
    async expire(key, seconds) {
      await vercelKV.expire(key, seconds);
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
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- tests/lib/auth/kv.test.ts
```

Expected: 6/6 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/kv.ts tests/lib/auth/kv.test.ts
git commit -m "feat(auth): KV 래퍼 + 메모리 더블 — 테스트 가능 인터페이스"
```

---

## Task 3: lib/auth/session.ts — 세션 헬퍼 (TDD)

**Files:**
- Create: `src/lib/auth/session.ts`
- Create: `tests/lib/auth/session.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/lib/auth/session.test.ts`:

```typescript
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
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/lib/auth/session.test.ts
```

Expected: FAIL.

- [ ] **Step 3: 구현**

`src/lib/auth/session.ts`:

```typescript
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
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- tests/lib/auth/session.test.ts
```

Expected: 6/6 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/session.ts tests/lib/auth/session.test.ts
git commit -m "feat(auth): 세션 헬퍼 — createSession/getSession/destroySession"
```

---

## Task 4: lib/auth/magic-link.ts — 토큰 헬퍼 (TDD)

**Files:**
- Create: `src/lib/auth/magic-link.ts`
- Create: `tests/lib/auth/magic-link.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/lib/auth/magic-link.test.ts`:

```typescript
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
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/lib/auth/magic-link.test.ts
```

Expected: FAIL.

- [ ] **Step 3: 구현**

`src/lib/auth/magic-link.ts`:

```typescript
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
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- tests/lib/auth/magic-link.test.ts
```

Expected: 6/6 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/magic-link.ts tests/lib/auth/magic-link.test.ts
git commit -m "feat(auth): Magic Link 토큰 헬퍼 — 1회용, 15분 만료"
```

---

## Task 5: lib/auth/rate-limit.ts — 레이트 리밋 (TDD)

**Files:**
- Create: `src/lib/auth/rate-limit.ts`
- Create: `tests/lib/auth/rate-limit.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/lib/auth/rate-limit.test.ts`:

```typescript
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
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/lib/auth/rate-limit.test.ts
```

Expected: FAIL.

- [ ] **Step 3: 구현**

`src/lib/auth/rate-limit.ts`:

```typescript
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
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- tests/lib/auth/rate-limit.test.ts
```

Expected: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/rate-limit.ts tests/lib/auth/rate-limit.test.ts
git commit -m "feat(auth): KV 기반 rate limit 헬퍼"
```

---

## Task 6: lib/auth/email-template.ts — 로그인 메일 본문

**Files:**
- Create: `src/lib/auth/email-template.ts`

- [ ] **Step 1: 구현**

`src/lib/auth/email-template.ts`:

```typescript
export interface LoginEmailParams {
  loginUrl: string;
  expiresInMinutes: number;
}

export function loginEmailText(params: LoginEmailParams): string {
  return [
    `Lincoln Brief 로그인 링크입니다.`,
    ``,
    `아래 링크를 클릭하시면 로그인되고 잠긴 글을 보실 수 있습니다.`,
    ``,
    params.loginUrl,
    ``,
    `이 링크는 ${params.expiresInMinutes}분 동안만 유효하며 한 번만 사용할 수 있습니다.`,
    ``,
    `링크를 요청하지 않으셨다면 이 메일을 무시해주세요.`,
    ``,
    `— Lincoln`,
  ].join('\n');
}

export function loginEmailHtml(params: LoginEmailParams): string {
  return `<!doctype html>
<html lang="ko">
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans KR', sans-serif; max-width: 480px; margin: 40px auto; padding: 24px; line-height: 1.6; color: #0f0c08;">
    <h1 style="font-size: 18px; margin: 0 0 16px;">Lincoln Brief 로그인 링크</h1>
    <p style="margin: 0 0 24px; color: #444;">아래 버튼을 클릭하시면 로그인되고 잠긴 글을 보실 수 있습니다.</p>
    <p style="margin: 0 0 32px;">
      <a href="${escapeHtml(params.loginUrl)}"
         style="display:inline-block; background:#d8b878; color:#0f0c08; text-decoration:none; padding:14px 28px; font-weight:600; border-radius:4px;">
        로그인하기
      </a>
    </p>
    <p style="font-size: 12px; color: #888; margin: 0 0 8px;">
      또는 다음 링크를 브라우저에 직접 붙여넣어주세요:
    </p>
    <p style="font-size: 11px; color: #555; word-break: break-all; margin: 0 0 24px;">
      ${escapeHtml(params.loginUrl)}
    </p>
    <p style="font-size: 12px; color: #888; margin: 0 0 4px;">
      이 링크는 ${params.expiresInMinutes}분 동안만 유효하며 한 번만 사용할 수 있습니다.
    </p>
    <p style="font-size: 12px; color: #888; margin: 0 0 32px;">
      링크를 요청하지 않으셨다면 이 메일을 무시해주세요.
    </p>
    <p style="font-size: 12px; color: #aaa; margin: 0;">— Lincoln Brief</p>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

- [ ] **Step 2: 빌드 확인**

```bash
npm run build
```

Expected: 성공.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/email-template.ts
git commit -m "feat(auth): 로그인 메일 템플릿 (HTML + text)"
```

---

## Task 7: POST /api/auth/magic-link — 토큰 발급 + 메일 발송

**Files:**
- Create: `src/pages/api/auth/magic-link.ts`

- [ ] **Step 1: 구현**

`src/pages/api/auth/magic-link.ts`:

```typescript
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

  // Rate limit: IP 분당 5회
  const ipLimit = await rateLimit(kv, {
    key: `magic-link-ip:${clientAddress ?? 'unknown'}`,
    limit: 5,
    windowSeconds: 60,
  });
  if (!ipLimit.ok) {
    return json({ ok: false, error: 'rate_limited' }, 429);
  }

  // Rate limit: 이메일 시간당 3회
  const emailLimit = await rateLimit(kv, {
    key: `magic-link-email:${email}`,
    limit: 3,
    windowSeconds: 3600,
  });
  if (!emailLimit.ok) {
    // 정보 누수 방지 — 동일 200 응답
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
    // 메일 발송 실패는 사용자에게 노출하지 않음 (정보 누수)
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
```

- [ ] **Step 2: 빌드 통과 확인**

```bash
npm run build
```

Expected: 성공. `.vercel/output/functions/api/auth/magic-link.func/` 생성됨 (Vercel 함수).

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/auth/magic-link.ts
git commit -m "feat(api): POST /api/auth/magic-link — 토큰 발급 + 메일 발송"
```

---

## Task 8: GET /api/auth/verify — 토큰 검증 + 세션 발급

**Files:**
- Create: `src/pages/api/auth/verify.ts`

- [ ] **Step 1: 구현**

`src/pages/api/auth/verify.ts`:

```typescript
import type { APIRoute } from 'astro';
import { createVercelKV } from '../../../lib/auth/kv';
import { consumeMagicLinkToken } from '../../../lib/auth/magic-link';
import {
  createSession,
  SESSION_COOKIE_NAME,
  sessionCookieAttributes,
} from '../../../lib/auth/session';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');
  const nextParam = url.searchParams.get('next') ?? '/';

  if (!token) {
    return errorRedirect('missing_token');
  }

  const kv = createVercelKV();
  const email = await consumeMagicLinkToken(kv, token);
  if (!email) {
    return errorRedirect('invalid_or_expired');
  }

  await kv.set(`users:${email}`, { email, lastSeenAt: Date.now() });
  const sid = await createSession(kv, email);

  // Open redirect 방지: next 는 같은 사이트의 path 만 허용
  const safeNext = nextParam.startsWith('/') && !nextParam.startsWith('//')
    ? nextParam
    : '/';

  return new Response(null, {
    status: 302,
    headers: {
      'Set-Cookie': `${SESSION_COOKIE_NAME}=${sid}; ${sessionCookieAttributes()}`,
      Location: safeNext,
    },
  });
};

function errorRedirect(reason: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: `/login?error=${encodeURIComponent(reason)}` },
  });
}
```

- [ ] **Step 2: 빌드 확인**

```bash
npm run build
```

Expected: 성공.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/auth/verify.ts
git commit -m "feat(api): GET /api/auth/verify — 토큰 검증 + 세션 발급"
```

---

## Task 9: POST /api/auth/logout

**Files:**
- Create: `src/pages/api/auth/logout.ts`

- [ ] **Step 1: 구현**

`src/pages/api/auth/logout.ts`:

```typescript
import type { APIRoute } from 'astro';
import { createVercelKV } from '../../../lib/auth/kv';
import {
  destroySession,
  SESSION_COOKIE_NAME,
  clearSessionCookieAttributes,
} from '../../../lib/auth/session';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  const sid = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sid) {
    const kv = createVercelKV();
    await destroySession(kv, sid);
  }
  return new Response(null, {
    status: 302,
    headers: {
      'Set-Cookie': `${SESSION_COOKIE_NAME}=; ${clearSessionCookieAttributes()}`,
      Location: '/',
    },
  });
};
```

- [ ] **Step 2: 빌드 확인**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/auth/logout.ts
git commit -m "feat(api): POST /api/auth/logout — 세션 삭제"
```

---

## Task 10: POST /api/auth/delete-account

**Files:**
- Create: `src/pages/api/auth/delete-account.ts`

- [ ] **Step 1: 구현**

`src/pages/api/auth/delete-account.ts`:

```typescript
import type { APIRoute } from 'astro';
import { createVercelKV } from '../../../lib/auth/kv';
import {
  destroySession,
  getSession,
  SESSION_COOKIE_NAME,
  clearSessionCookieAttributes,
} from '../../../lib/auth/session';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  const sid = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sid) {
    return new Response(null, { status: 302, headers: { Location: '/' } });
  }
  const kv = createVercelKV();
  const session = await getSession(kv, sid);
  if (session) {
    await kv.del(`users:${session.email}`);
  }
  await destroySession(kv, sid);
  return new Response(null, {
    status: 302,
    headers: {
      'Set-Cookie': `${SESSION_COOKIE_NAME}=; ${clearSessionCookieAttributes()}`,
      Location: '/?deleted=1',
    },
  });
};
```

> 단순화: 세션 1개만 삭제 (현재 브라우저). 다른 디바이스 세션 추적·삭제는 Phase 3 (사용자 → 세션 인덱스). Phase 2 범위에선 사용자 레코드 + 현재 세션만 지운다.

- [ ] **Step 2: 빌드 확인**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/auth/delete-account.ts
git commit -m "feat(api): POST /api/auth/delete-account — 사용자 + 현재 세션 삭제"
```

---

## Task 11: middleware.ts — 세션 확인 + Astro.locals.user 주입

**Files:**
- Create: `src/middleware.ts`
- Modify: `src/env.d.ts` (또는 신규 생성)

- [ ] **Step 1: env.d.ts 에 Astro.locals 타입 추가**

`src/env.d.ts` 가 이미 있으면 끝에 추가, 없으면 생성:

```typescript
/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    user: { email: string } | null;
  }
}
```

- [ ] **Step 2: 미들웨어 구현**

`src/middleware.ts`:

```typescript
import { defineMiddleware } from 'astro:middleware';
import { createVercelKV } from './lib/auth/kv';
import { getSession, SESSION_COOKIE_NAME } from './lib/auth/session';

export const onRequest = defineMiddleware(async ({ cookies, locals }, next) => {
  locals.user = null;
  const sid = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sid) {
    try {
      const kv = createVercelKV();
      const session = await getSession(kv, sid);
      if (session) {
        locals.user = { email: session.email };
      }
    } catch (err) {
      // KV 연결 실패 등 — 비로그인으로 안전 fallback
      console.error('[middleware] session check failed:', err);
    }
  }
  return next();
});
```

- [ ] **Step 3: 빌드 통과**

```bash
npm run build
```

Expected: 성공. 미들웨어 함수가 hybrid SSR 라우트에 적용됨. 정적 페이지에는 미들웨어가 빌드 시 실행되지 않지만, 게이팅 해제는 [...slug].astro 가 SSR 로 전환되어야 작동 — 다음 task 에서 처리.

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts src/env.d.ts
git commit -m "feat(auth): middleware — 세션 확인 + Astro.locals.user 주입"
```

---

## Task 12: blog/[...slug].astro — 로그인 시 게이팅 해제

**중요한 결정:** Phase 1 의 [...slug].astro 는 정적 빌드 (getStaticPaths). 세션 검사를 위해선 SSR 로 전환 필요. 그러면 모든 글이 매 요청마다 SSR — 캐시 안 됨, 빌드 시 본문 누출 검증도 의미 없어짐. 두 방안:

A. **모든 글 SSR 전환** — middleware 가 세션 검사. locked + 비로그인 → 티저, locked + 로그인 → 전체, free → 전체. 매 요청 SSR (작은 사이트라 비용 OK).

B. **잠긴 글만 SSR, 무료 글은 static** — getStaticPaths 가 free 카테고리만 prerender. locked 는 [...slug].ts API 처럼 SSR. 코드 복잡도 큼.

**선택: A.** 단순함 우선. Vercel serverless function cold start 영향 미미 (한국 사용자 대상, KV REST 도 빠름).

**Files:**
- Modify: `src/pages/blog/[...slug].astro`

- [ ] **Step 1: SSR 전환 + 게이팅 분기**

`src/pages/blog/[...slug].astro` 전체 교체:

```astro
---
import { getCollection } from 'astro:content';
import BlogPost from '../../layouts/BlogPost.astro';
import PaywallTeaser from '../../components/PaywallTeaser.astro';
import { isLocked } from '../../lib/gating';
import { extractTeaserParagraphs, renderTeaserHtml } from '../../lib/teaser';

export const prerender = false;

const slug = Astro.params.slug;
const posts = await getCollection('blog');
const post = posts.find((p) => p.slug === slug);

if (!post) {
  return new Response(null, { status: 404 });
}

const locked = isLocked(post);
const user = Astro.locals.user;
const showTeaser = locked && !user;

const { Content } = await post.render();

let teaserHtml = '';
if (showTeaser) {
  const paragraphs = extractTeaserParagraphs(post.body, 3);
  teaserHtml = renderTeaserHtml(paragraphs);
}
---

<BlogPost post={post}>
  {showTeaser ? (
    <PaywallTeaser teaserHtml={teaserHtml} slug={post.slug} category={post.data.category} />
  ) : (
    <Content />
  )}
</BlogPost>
```

- [ ] **Step 2: 빌드 통과**

```bash
npm run build
```

Expected: 성공. `.vercel/output/functions/blog/_---slug_.func/` 에 SSR 함수 생성됨. 기존 정적 HTML (`.vercel/output/static/blog/...`) 은 사라짐.

- [ ] **Step 3: Commit**

```bash
git add src/pages/blog/[...slug].astro
git commit -m "feat(gating): 로그인 사용자 잠금 해제 — SSR 전환 + locals.user 분기"
```

---

## Task 13: SubscribeForm.astro — Magic Link 폼

**Files:**
- Create: `src/components/SubscribeForm.astro`

- [ ] **Step 1: 컴포넌트 작성**

`src/components/SubscribeForm.astro`:

```astro
---
interface Props {
  next?: string;
}
const { next = '/' } = Astro.props;
---

<form id="lb-subscribe-form" class="mx-auto max-w-sm">
  <label for="lb-email" class="sr-only">이메일</label>
  <input
    type="email"
    id="lb-email"
    name="email"
    required
    autocomplete="email"
    placeholder="your@email.com"
    class="w-full border border-ink-600 bg-ink-950 px-4 py-3 text-base text-ink-50 placeholder:text-ink-400 focus:border-gold-500 focus:outline-none"
  />
  <input type="hidden" name="next" value={next} />
  <button
    type="submit"
    class="mt-3 w-full bg-gold-500 px-6 py-3 text-sm font-medium uppercase tracking-widest-2 text-ink-950 transition hover:bg-gold-400 disabled:opacity-50"
  >
    무료 구독 시작 →
  </button>
  <p class="mt-3 text-xs text-ink-400" id="lb-form-hint">
    이메일로 로그인 링크가 발송됩니다. 비밀번호 없음.
  </p>
  <div id="lb-form-success" class="mt-6 hidden border border-gold-700 bg-ink-950 p-4 text-center">
    <p class="font-serif text-base italic text-ink-50">메일함을 확인해주세요</p>
    <p class="mt-2 text-xs text-ink-300">로그인 링크를 보내드렸습니다. 15분 안에 클릭해주세요.</p>
  </div>
</form>

<script>
  const form = document.getElementById('lb-subscribe-form') as HTMLFormElement | null;
  const success = document.getElementById('lb-form-success');
  const hint = document.getElementById('lb-form-hint');
  if (form && success && hint) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const button = form.querySelector('button') as HTMLButtonElement;
      button.disabled = true;
      button.textContent = '발송 중…';
      try {
        const res = await fetch('/api/auth/magic-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: data.get('email'),
            next: data.get('next'),
          }),
        });
        if (res.ok) {
          form.style.display = 'none';
          hint.style.display = 'none';
          success.classList.remove('hidden');
        } else if (res.status === 429) {
          hint.textContent = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
          button.disabled = false;
          button.textContent = '무료 구독 시작 →';
        } else {
          hint.textContent = '오류가 발생했습니다. 이메일을 확인해주세요.';
          button.disabled = false;
          button.textContent = '무료 구독 시작 →';
        }
      } catch {
        hint.textContent = '네트워크 오류. 잠시 후 다시 시도해주세요.';
        button.disabled = false;
        button.textContent = '무료 구독 시작 →';
      }
    });
  }
</script>
```

- [ ] **Step 2: 빌드 확인**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SubscribeForm.astro
git commit -m "feat(form): SubscribeForm — Magic Link 이메일 입력 폼"
```

---

## Task 14: /subscribe — Stibee 버튼을 SubscribeForm 으로 교체

**Files:**
- Modify: `src/pages/subscribe.astro`

- [ ] **Step 1: 구독 폼 섹션 교체**

`src/pages/subscribe.astro` 의 `<!-- 구독 폼 -->` 섹션 (현재 `stibeeUrl ? <Stibee 버튼> : <준비 중>` 분기) 을 다음으로 교체:

기존:
```astro
<!-- 구독 폼 -->
<section class="py-20">
  <div class="container-x">
    <div class="mx-auto max-w-md text-center">
      <p class="eyebrow text-gold-400">지금 구독하기</p>
      <h2 class="mt-4 font-serif text-3xl text-ink-50">이메일 하나로 시작</h2>
      {stibeeUrl ? (
        <>
          <p class="mt-6 text-sm text-ink-200">
            아래 버튼을 누르면 구독 페이지로 이동합니다. 이메일만 입력하시면 됩니다.
          </p>
          <a
            href={stibeeUrl}
            target="_blank"
            rel="noopener"
            class="mt-8 inline-block bg-gold-500 px-10 py-4 text-sm font-medium uppercase tracking-widest-2 text-ink-950 transition hover:bg-gold-400"
          >
            무료 구독 시작 →
          </a>
          <p class="mt-4 text-xs text-ink-400">언제든 취소 가능 · 스팸 없음</p>
        </>
      ) : (
        <div class="mt-8 border border-gold-700 bg-ink-950 p-6">
          <p class="font-serif text-lg italic text-ink-100">구독 폼 준비 중</p>
          <p class="mt-2 text-xs text-ink-300">조금만 기다려주세요. 곧 구독 폼이 열립니다.</p>
        </div>
      )}
    </div>
  </div>
</section>
```

변경 후:
```astro
<!-- 구독 폼 -->
<section class="py-20">
  <div class="container-x">
    <div class="mx-auto max-w-md text-center">
      <p class="eyebrow text-gold-400">지금 구독하기</p>
      <h2 class="mt-4 font-serif text-3xl text-ink-50">이메일 하나로 시작</h2>
      <p class="mt-6 text-sm text-ink-200">
        이메일만 입력하시면 로그인 링크를 메일로 보내드립니다. 비밀번호 없음.
      </p>
      <div class="mt-8">
        <SubscribeForm next={fromSlug ? `/blog/${fromSlug}/` : '/'} />
      </div>
    </div>
  </div>
</section>
```

추가로 frontmatter 에:
- `import SubscribeForm from '../components/SubscribeForm.astro';` 추가
- `const fromSlug = Astro.url.searchParams.get('from') ?? '';` 재추가 (Task Phase 1 에서 제거된 변수 — 이번엔 실제 사용)
- `stibeeUrl` 변수 / STIBEE import 제거 (이제 불필요)

frontmatter 최종:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import SubscribeForm from '../components/SubscribeForm.astro';
import { CATEGORIES } from '../consts';
import { LOCKED_CATEGORIES } from '../lib/gating';
import { getCollection } from 'astro:content';

const lockedSet = new Set<string>(LOCKED_CATEGORIES);
const lockedCategories = CATEGORIES.filter((c) => lockedSet.has(c.slug));

const allPosts = await getCollection('blog');
const sampleFreePosts = allPosts
  .filter((p) => !lockedSet.has(p.data.category))
  .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
  .slice(0, 3);

const fromSlug = Astro.url.searchParams.get('from') ?? '';
---
```

- [ ] **Step 2: 빌드 통과**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/subscribe.astro
git commit -m "feat(subscribe): Stibee 버튼 → Magic Link 폼 교체 + from 파라미터 소비"
```

---

## Task 15: /login.astro — 이미 회원용 로그인 페이지

**Files:**
- Create: `src/pages/login.astro`

- [ ] **Step 1: 페이지 작성**

`src/pages/login.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import SubscribeForm from '../components/SubscribeForm.astro';

const error = Astro.url.searchParams.get('error');
const errorMessages: Record<string, string> = {
  missing_token: '로그인 링크가 올바르지 않습니다.',
  invalid_or_expired: '링크가 만료되었거나 이미 사용되었습니다. 다시 요청해주세요.',
};
const errorMessage = error ? errorMessages[error] ?? '오류가 발생했습니다.' : null;
---

<BaseLayout
  title="로그인 — Lincoln Brief"
  description="Magic Link 로 로그인합니다. 비밀번호 없음."
>
  <article class="bg-ink-900">
    <section class="py-20">
      <div class="container-x">
        <div class="mx-auto max-w-md text-center">
          <p class="eyebrow text-gold-400">로그인</p>
          <h1 class="mt-4 font-serif text-3xl text-ink-50">이메일로 로그인</h1>
          <p class="mt-6 text-sm text-ink-200">
            가입하신 이메일을 입력하시면 로그인 링크를 보내드립니다.
          </p>
          {errorMessage && (
            <div class="mt-6 border border-red-700 bg-red-950/40 p-4 text-sm text-red-200">
              {errorMessage}
            </div>
          )}
          <div class="mt-8">
            <SubscribeForm />
          </div>
          <p class="mt-12 text-xs text-ink-400">
            아직 구독 안 하셨나요?
            <a href="/subscribe" class="ml-2 text-gold-400 hover:text-gold-300">구독 안내 보기 →</a>
          </p>
        </div>
      </div>
    </section>
  </article>
</BaseLayout>
```

- [ ] **Step 2: 빌드 확인**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/login.astro
git commit -m "feat(login): /login — Magic Link 폼 + 에러 안내"
```

---

## Task 16: /account.astro — 계정 설정

**Files:**
- Create: `src/pages/account.astro`

- [ ] **Step 1: 페이지 작성**

`src/pages/account.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';

export const prerender = false;

const user = Astro.locals.user;
if (!user) {
  return Astro.redirect('/login');
}

const deleted = Astro.url.searchParams.get('deleted') === '1';
---

<BaseLayout title="계정 — Lincoln Brief" description="계정 설정">
  <article class="bg-ink-900">
    <section class="py-20">
      <div class="container-x">
        <div class="mx-auto max-w-md">
          <p class="eyebrow text-gold-400">계정</p>
          <h1 class="mt-4 font-serif text-3xl text-ink-50">계정 설정</h1>

          <div class="mt-10 border border-ink-600 bg-ink-950 p-6">
            <p class="text-xs uppercase tracking-widest-2 text-ink-400">가입 이메일</p>
            <p class="mt-2 font-mono text-base text-ink-50">{user.email}</p>
          </div>

          <form method="POST" action="/api/auth/logout" class="mt-6">
            <button
              type="submit"
              class="w-full border border-ink-600 px-6 py-3 text-sm font-medium uppercase tracking-widest-2 text-ink-100 transition hover:border-gold-500 hover:text-gold-400"
            >
              로그아웃
            </button>
          </form>

          <div class="mt-16 border-t border-ink-700 pt-8">
            <h2 class="font-serif text-lg text-ink-50">계정 삭제</h2>
            <p class="mt-3 text-sm text-ink-300">
              계정을 삭제하면 즉시 모든 정보가 제거되고 잠긴 글에 다시 접근할 수 없게 됩니다.
            </p>
            <form
              method="POST"
              action="/api/auth/delete-account"
              class="mt-6"
              onsubmit="return confirm('정말 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.');"
            >
              <button
                type="submit"
                class="text-sm text-red-400 underline hover:text-red-300"
              >
                계정 삭제하기
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  </article>
</BaseLayout>
```

- [ ] **Step 2: 빌드 확인**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/account.astro
git commit -m "feat(account): /account — 이메일 표시 + 로그아웃 + 탈퇴"
```

---

## Task 17: Header.astro — 우상단에 로그인/계정 링크

**Files:**
- Modify: `src/components/Header.astro`

- [ ] **Step 1: 현재 Header 확인**

```bash
cat src/components/Header.astro
```

- [ ] **Step 2: 로그인 / 계정 링크 추가**

Header 의 우상단 (보통 검색 버튼 옆 등) 에 다음 블록 삽입:

```astro
---
// 기존 import 들 아래에
const user = Astro.locals.user;
---

{user ? (
  <a href="/account" class="text-[11px] uppercase tracking-widest-2 text-ink-300 hover:text-gold-400">
    계정
  </a>
) : (
  <a href="/login" class="text-[11px] uppercase tracking-widest-2 text-ink-300 hover:text-gold-400">
    로그인
  </a>
)}
```

> 정확한 위치는 기존 Header 구조에 맞춰 — 보통 우상단의 네비게이션 아이템 옆. 검색·메뉴 토글 등이 있다면 그 옆.

- [ ] **Step 3: Header 가 SSR 되도록 — Header 를 쓰는 페이지가 SSR 이어야 user 정보 채워짐**

홈 (`src/pages/index.astro`) 과 카테고리 (`src/pages/category/[slug].astro`) 가 정적이면 user 가 빌드 시 null 로 박힘. 두 가지 선택:

A. 홈·카테고리·about 도 SSR 전환 — `export const prerender = false;` 추가
B. Header 클라이언트 사이드에서 fetch 로 사용자 확인 — JS 의존 (cookie httpOnly 라 직접 못 읽음 → /api/auth/me 추가 필요)

**선택: A.** 단순하고 일관. SSR 비용 미미.

다음 파일 상단에 `export const prerender = false;` 추가:
- `src/pages/index.astro`
- `src/pages/category/[slug].astro`
- `src/pages/about.astro` (있다면)

> Keystatic 관련 라우트 (`/keystatic`, `/api/keystatic/*`) 는 이미 SSR — 그대로.

- [ ] **Step 4: 빌드 통과 확인**

```bash
npm run build
```

Expected: 빌드 성공. 정적 페이지 수 감소, SSR 함수 수 증가. `.vercel/output/functions/` 안에 `index.func`, `category/_slug_.func` 등 생성.

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.astro src/pages/index.astro src/pages/category/\[slug\].astro src/pages/about.astro
git commit -m "feat(header): 로그인/계정 링크 + 관련 페이지 SSR 전환"
```

> about.astro 가 없으면 add 에서 제외.

---

## Task 18: RSS / PostCard 회귀 점검

게이팅 로직이 SSR 전환 후에도 동일하게 작동하는지 확인.

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트**

```bash
npm test
```

Expected: 모든 단위 테스트 PASS (Phase 1 16개 + Phase 2 신규 17개 = 33개 이상).

- [ ] **Step 2: 빌드 + RSS 게이팅**

```bash
npm run build
grep -c "전체 보기는 구독 후 가능합니다" .vercel/output/static/rss.xml
```

Expected: 잠긴 글 수만큼 (Phase 1 과 동일).

- [ ] **Step 3: PostCard 🔒**

홈은 SSR 이라 정적 산출물에 없을 수 있음. SSR 함수 코드는 빌드 시 확인 어려움 — 다음 task 의 수동 검증에서 같이.

---

## Task 19: 수동 E2E (인프라 준비 완료 후)

**Files:** 검증 전용. Task 0 가 완료되어 환경변수가 실제 값으로 채워진 상태여야 한다.

- [ ] **Step 1: 로컬 dev 서버**

```bash
npm run dev
```

(`.env` 가 채워져 있어야 KV / Resend 호출 가능)

- [ ] **Step 2: 시나리오 — 신규 구독**

1. `http://localhost:4321/` 접속 — 우상단에 "로그인" 링크 표시
2. 잠긴 글 (시장예측 또는 종목분석) 클릭 → 티저 + CTA
3. CTA "무료 구독 시작" 클릭 → `/subscribe?from=…`
4. 페이지 하단 폼에서 이메일 입력 → 제출
5. 폼이 사라지고 "메일함을 확인해주세요" 박스 등장
6. 실제 이메일 수신함 확인 → "Lincoln Brief 로그인 링크" 메일 도착
7. 메일의 "로그인하기" 버튼 클릭
8. 브라우저가 원래 잠긴 글로 이동 → **전체 본문 표시** ✅
9. 우상단 링크가 "계정" 으로 바뀜
10. 새 탭에서 같은 잠긴 글 다시 접속 → 본문 표시 (세션 유지)

- [ ] **Step 3: 시나리오 — 로그아웃 / 재로그인**

11. `/account` → 로그아웃 클릭
12. 잠긴 글 접속 → 티저로 복귀
13. `/login` → 이메일 입력 → 메일 재수신 → 링크 클릭 → 로그인 복원

- [ ] **Step 4: 시나리오 — 탈퇴**

14. `/account` → "계정 삭제하기" 클릭 → 확인 다이얼로그
15. 즉시 홈으로 리다이렉트 + 쿠키 삭제됨 (F12 → Application → Cookies)
16. 잠긴 글 접속 → 티저로 복귀 ✅
17. 같은 이메일로 재구독 시도 → 정상 작동 (새 사용자처럼)

- [ ] **Step 5: 시나리오 — 만료된 토큰**

18. 신규 magic-link 요청 → 메일 확인 → **15분 이상 기다림**
19. 링크 클릭 → `/login?error=invalid_or_expired` 로 리다이렉트 + 에러 메시지

- [ ] **Step 6: 시나리오 — Rate limit**

20. 같은 이메일로 1시간 내 4번째 요청 → 200 반환되지만 메일 안 옴 (정보 누수 방지)
21. F12 Network 탭에서 응답 확인

---

## Task 20: 프로덕션 머지 + 배포

- [ ] **Step 1: 모든 task 완료 + 전체 테스트 PASS 확인**

```bash
npm test
npm run build
```

- [ ] **Step 2: PR 생성**

```bash
git push -u origin feat/phase2-auth
gh pr create --title "Phase 2: Magic Link 인증 + 세션 + /account" --body "..."
```

- [ ] **Step 3: Vercel preview 에서 E2E 재실행**

Preview 환경변수가 Vercel 대시보드에 등록되어 있어야 함 (Task 0.3 에서 확인).

- [ ] **Step 4: 머지 + Vercel 프로덕션 배포 자동**

---

## Self-Review

**Spec 커버리지 점검:**

- §1 카테고리 정책 — Phase 1 이미 처리
- §2 사용자 흐름 (게스트→메일→로그인→본문) — Task 7-13 ✓
- §2 재방문 — Task 11 middleware + Task 12 분기 ✓
- §2 탈퇴 — Task 10 + Task 16 ✓
- §3 데이터 플로우 — Task 7-11 ✓
- §3 KV 모델 (magic-link, session, users, unsubscribe) — Task 4, 3, 8 ✓ / unsubscribe 토큰은 Phase 3 (메일 푸터 별도 트랙)
- §3 환경변수 — Task 0 ✓
- §4 PaywallTeaser — Phase 1
- §4 SubscribeForm — Task 13 ✓
- §4 /subscribe — Task 14 ✓
- §4 /account — Task 16 ✓
- §5 SEO — 잠긴 글은 게스트에게 title/meta 만 노출 (Task 12 분기로 자동)
- §5 RSS — Phase 1 이미 처리, 회귀 점검 Task 18 ✓
- §5 자동화·Keystatic — 영향 없음 ✓
- §6 보안 — Task 4 (1회용 토큰), Task 3 (httpOnly Secure SameSite), Task 5 (rate limit), Task 7 (정보 누수 방지 동일 응답) ✓
- §7 Phase 2 정의와 일치 ✓
- §9 결정 보류 — 미해결 항목은 그대로 유지 (메일 캠페인, 1000명+ 사회적증거)

**Placeholder 점검:** TBD / TODO / "implement later" 없음. Task 17 의 "정확한 위치는 기존 Header 구조에 맞춰" 는 실행자가 판단할 컨텍스트 — 명세 위반 아님.

**타입 일관성:**
- `KVClient` 인터페이스 — Task 2 정의, Task 3/4/5/7/8/9/10/11 사용 일관
- `SessionData = { email }` — Task 3 정의, Task 11 의 `locals.user = { email }` 와 호환
- `Astro.locals.user: { email: string } | null` — Task 11 의 env.d.ts 와 Task 12/16/17 사용 일관

**Phase 2 명시적 제외:**
- 본문 메일 발송 (캠페인) → Phase 3 별도 spec
- /privacy + /terms 정적 페이지 → 별도 후속
- 사용자 → 세션 인덱스 (다중 디바이스 로그아웃) → Phase 3
- premium 전용 RSS (토큰 URL) → Phase 4+
- Stibee 트랜잭셔널 / 캠페인 → Phase 3
