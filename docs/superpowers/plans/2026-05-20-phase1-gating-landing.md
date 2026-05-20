# Phase 1: 구독 게이팅 + 가치제안 랜딩 + RSS 티저 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시장예측·종목분석 카테고리 글에 게스트 진입 시 첫 2-3문단만 보이는 티저 UX, /subscribe 가치제안 랜딩 페이지, RSS 티저 잘라내기까지 인증 없이 완성하고 배포.

**Architecture:** Astro 4.16 hybrid 정적 빌드 그대로. 게이팅은 `[...slug].astro` 렌더링 시점에서 `frontmatter.category` 확인 → `PaywallTeaser` vs 전체 `<Content />` 분기. 인증 미존재 단계 — 모든 비로그인 사용자에게 항상 티저 표시 (Phase 2 에서 세션 확인 추가). 구독 폼은 Stibee 임베드 URL (`consts.ts` `STIBEE.SUBSCRIBE_URL`) 사용.

**Tech Stack:** Astro 4.16, Tailwind 3.4, Vitest (신규 도입 — 헬퍼 테스트용), `marked` (티저 markdown 렌더링), Node 20.

**Spec:** `docs/superpowers/specs/2026-05-20-subscription-gating-design.md`

---

## File Structure

신규:
- `src/lib/gating.ts` — `LOCKED_CATEGORIES` 상수 + `isLocked(post)` 헬퍼
- `src/lib/teaser.ts` — markdown 본문에서 첫 N 단락 추출 + HTML 렌더링
- `src/components/PaywallTeaser.astro` — 티저 + 페이드 + CTA 박스
- `src/pages/subscribe.astro` — 가치제안 풀랜딩 페이지
- `tests/lib/gating.test.ts` — `isLocked` 단위 테스트
- `tests/lib/teaser.test.ts` — 단락 추출 단위 테스트
- `vitest.config.ts` — Vitest 설정

수정:
- `src/pages/blog/[...slug].astro` — locked + 비로그인 → 티저 렌더링 분기
- `src/pages/rss.xml.js` — locked 카테고리 글은 `description` 만 (요약만, 본문 없음)
- `src/components/PostCard.astro` — 잠금 표시 아이콘 추가 (홈/카테고리/검색 카드)
- `package.json` — Vitest + marked 의존성 + `test` 스크립트

---

## Task 1: Vitest 설정 + 의존성 추가

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (dependencies + scripts)

- [ ] **Step 1: 의존성 설치**

```bash
npm install --save-dev vitest @vitest/ui
npm install marked
```

Expected: package.json 의 `devDependencies` 에 `vitest`, `@vitest/ui` 추가. `dependencies` 에 `marked` 추가.

- [ ] **Step 2: vitest.config.ts 생성**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 3: package.json 에 test 스크립트 추가**

`scripts` 객체에 다음 라인 추가:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: 빈 테스트 실행 확인**

```bash
npm test
```

Expected: `No test files found` 또는 0개 통과. Vitest 정상 실행되면 성공.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: Vitest + marked 추가 — Phase 1 게이팅 기반"
```

---

## Task 2: gating.ts — LOCKED_CATEGORIES 상수 + isLocked 헬퍼 (TDD)

**Files:**
- Create: `src/lib/gating.ts`
- Test: `tests/lib/gating.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/lib/gating.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isLocked, LOCKED_CATEGORIES } from '../../src/lib/gating';

describe('LOCKED_CATEGORIES', () => {
  it('정확히 market-forecast 와 stock-analysis 만 잠금', () => {
    expect(LOCKED_CATEGORIES).toEqual(['market-forecast', 'stock-analysis']);
  });
});

describe('isLocked', () => {
  it('market-forecast 카테고리 글은 잠금', () => {
    expect(isLocked({ data: { category: 'market-forecast' } } as any)).toBe(true);
  });
  it('stock-analysis 카테고리 글은 잠금', () => {
    expect(isLocked({ data: { category: 'stock-analysis' } } as any)).toBe(true);
  });
  it('daily-brief 는 잠금 아님', () => {
    expect(isLocked({ data: { category: 'daily-brief' } } as any)).toBe(false);
  });
  it('economy-issue 는 잠금 아님', () => {
    expect(isLocked({ data: { category: 'economy-issue' } } as any)).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/lib/gating.test.ts
```

Expected: FAIL — `Cannot find module '../../src/lib/gating'`

- [ ] **Step 3: 최소 구현**

`src/lib/gating.ts`:

```typescript
import type { CollectionEntry } from 'astro:content';

export const LOCKED_CATEGORIES = ['market-forecast', 'stock-analysis'] as const;

export type LockedCategory = (typeof LOCKED_CATEGORIES)[number];

export function isLocked(post: CollectionEntry<'blog'>): boolean {
  return (LOCKED_CATEGORIES as readonly string[]).includes(post.data.category);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- tests/lib/gating.test.ts
```

Expected: 5/5 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/gating.ts tests/lib/gating.test.ts
git commit -m "feat(gating): LOCKED_CATEGORIES + isLocked 헬퍼"
```

---

## Task 3: teaser.ts — markdown 첫 N 단락 추출 (TDD)

**Files:**
- Create: `src/lib/teaser.ts`
- Test: `tests/lib/teaser.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/lib/teaser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { extractTeaserParagraphs, renderTeaserHtml } from '../../src/lib/teaser';

describe('extractTeaserParagraphs', () => {
  it('첫 3개 단락 반환 (기본)', () => {
    const md = '첫번째 단락.\n\n두번째 단락.\n\n세번째 단락.\n\n네번째 단락.';
    expect(extractTeaserParagraphs(md)).toEqual([
      '첫번째 단락.',
      '두번째 단락.',
      '세번째 단락.',
    ]);
  });

  it('단락 수가 부족하면 있는 만큼만', () => {
    const md = '하나뿐인 단락.';
    expect(extractTeaserParagraphs(md)).toEqual(['하나뿐인 단락.']);
  });

  it('빈 줄 여러 개도 정상 처리', () => {
    const md = '하나.\n\n\n\n둘.';
    expect(extractTeaserParagraphs(md)).toEqual(['하나.', '둘.']);
  });

  it('마크다운 헤더는 단락에서 제외', () => {
    const md = '# 제목\n\n첫 단락.\n\n두번째.';
    expect(extractTeaserParagraphs(md)).toEqual(['첫 단락.', '두번째.']);
  });

  it('count 옵션 지원', () => {
    const md = 'A.\n\nB.\n\nC.\n\nD.';
    expect(extractTeaserParagraphs(md, 2)).toEqual(['A.', 'B.']);
  });
});

describe('renderTeaserHtml', () => {
  it('단락 배열을 <p> 태그로 감싼 HTML 반환', () => {
    const html = renderTeaserHtml(['첫째.', '둘째.']);
    expect(html).toContain('<p>첫째.</p>');
    expect(html).toContain('<p>둘째.</p>');
  });

  it('마크다운 인라인 강조 변환', () => {
    const html = renderTeaserHtml(['**굵게** 표시.']);
    expect(html).toContain('<strong>굵게</strong>');
  });

  it('단락 안에 링크가 있으면 변환', () => {
    const html = renderTeaserHtml(['[링크](https://example.com) 입니다.']);
    expect(html).toContain('<a href="https://example.com">링크</a>');
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/lib/teaser.test.ts
```

Expected: FAIL — `Cannot find module '../../src/lib/teaser'`

- [ ] **Step 3: 최소 구현**

`src/lib/teaser.ts`:

```typescript
import { marked } from 'marked';

export function extractTeaserParagraphs(markdown: string, count = 3): string[] {
  return markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0 && !block.startsWith('#'))
    .slice(0, count);
}

export function renderTeaserHtml(paragraphs: string[]): string {
  return paragraphs
    .map((p) => marked.parseInline(p))
    .map((html) => `<p>${html}</p>`)
    .join('\n');
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- tests/lib/teaser.test.ts
```

Expected: 8/8 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/teaser.ts tests/lib/teaser.test.ts
git commit -m "feat(teaser): markdown 첫 N 단락 추출 + HTML 렌더링"
```

---

## Task 4: PaywallTeaser.astro 컴포넌트 작성

**Files:**
- Create: `src/components/PaywallTeaser.astro`

- [ ] **Step 1: 컴포넌트 작성**

`src/components/PaywallTeaser.astro`:

```astro
---
interface Props {
  teaserHtml: string;
  slug: string;
  category: string;
}

const { teaserHtml, slug, category } = Astro.props;
const ctaHref = `/subscribe?from=${encodeURIComponent(slug)}&category=${encodeURIComponent(category)}`;
---

<div class="relative">
  <!-- 티저 본문 -->
  <div class="teaser-content prose prose-invert prose-lg max-w-none
              prose-p:leading-relaxed prose-p:text-ink-100
              prose-strong:text-gold-400 prose-strong:font-medium
              prose-a:text-gold-400 prose-a:no-underline prose-a:border-b prose-a:border-gold-700"
       set:html={teaserHtml}>
  </div>

  <!-- 페이드 그라데이션 -->
  <div
    class="pointer-events-none absolute inset-x-0 -bottom-2 h-32"
    style="background: linear-gradient(to bottom, transparent 0%, rgb(10 10 10 / 0.8) 70%, rgb(10 10 10) 100%);"
    aria-hidden="true"
  ></div>
</div>

<!-- CTA 박스 -->
<div class="mt-12 border border-gold-700 bg-ink-950 p-8 text-center">
  <p class="text-[11px] uppercase tracking-widest-2 text-gold-400">🔒 구독자 전용</p>
  <p class="mt-4 font-serif text-2xl italic text-ink-50">
    이 글의 전체 내용은 구독자만 읽을 수 있습니다
  </p>
  <p class="mt-3 text-sm text-ink-200">
    무료 구독하시면 시장 예측·종목 분석 분야의 모든 글을 메일과 웹에서 받아보실 수 있습니다.
  </p>
  <a
    href={ctaHref}
    class="mt-8 inline-block bg-gold-500 px-8 py-3 text-sm font-medium uppercase tracking-widest-2 text-ink-950 transition hover:bg-gold-400"
  >
    무료 구독 시작 →
  </a>
</div>
```

- [ ] **Step 2: 빌드 확인 (사용처 없이도 컴파일되는지)**

```bash
npm run build
```

Expected: 빌드 성공. PaywallTeaser 는 아직 어디서도 사용 안 됨 → tree-shaking 으로 무시되거나 정상 컴파일.

- [ ] **Step 3: Commit**

```bash
git add src/components/PaywallTeaser.astro
git commit -m "feat(component): PaywallTeaser — 티저 + 페이드 + CTA"
```

---

## Task 5: [...slug].astro — 잠긴 글 티저 분기

**Files:**
- Modify: `src/pages/blog/[...slug].astro`

- [ ] **Step 1: 페이지 전체 교체**

`src/pages/blog/[...slug].astro` 내용을 다음으로 교체:

```astro
---
import { getCollection } from 'astro:content';
import BlogPost from '../../layouts/BlogPost.astro';
import PaywallTeaser from '../../components/PaywallTeaser.astro';
import { isLocked } from '../../lib/gating';
import { extractTeaserParagraphs, renderTeaserHtml } from '../../lib/teaser';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { post },
  }));
}

const { post } = Astro.props;
const locked = isLocked(post);
const { Content } = await post.render();

let teaserHtml = '';
if (locked) {
  const paragraphs = extractTeaserParagraphs(post.body, 3);
  teaserHtml = renderTeaserHtml(paragraphs);
}
---

<BlogPost post={post}>
  {locked ? (
    <PaywallTeaser teaserHtml={teaserHtml} slug={post.slug} category={post.data.category} />
  ) : (
    <Content />
  )}
</BlogPost>
```

- [ ] **Step 2: 빌드 + 시각 확인 (수동)**

```bash
npm run dev
```

브라우저에서 확인:
1. `http://localhost:4321/blog/<slug>` — 무료 카테고리 글 (예: `kr-daily-brief-20260520`) → 전체 본문 정상
2. `http://localhost:4321/blog/<slug>` — 시장예측 글 (예: 최근 `*market-forecast*` 슬러그) → 첫 3단락 + 페이드 + CTA 보임
3. CTA 클릭 → `/subscribe?from=…&category=…` 이동 (다음 task 에서 페이지 만들기 전이면 404 — 정상)

Expected: 잠긴 글은 본문 길이가 1/10 미만으로 줄어듦. F12 → Elements 에서 본문 HTML 이 첫 3단락만 있는지 확인 (전체 본문이 DOM 에 숨겨져 있으면 안 됨).

- [ ] **Step 3: 빌드 통과 확인**

```bash
npm run build
```

Expected: 빌드 성공. 모든 글 (`.vercel/output/static/blog/<slug>/index.html`) 생성. 잠긴 글 HTML 파일 안에 본문 전체가 들어있지 않은지 grep 검증:

```bash
# 임의 잠긴 글 1편 골라서 — 본문 끝의 "— Lincoln" 사인오프는 있어야 (BlogPost layout)
# 잠긴 글의 본문 중간에 있던 문장 한 줄 골라서 HTML 에 없는지 확인
grep -c "본문 중간 텍스트" .vercel/output/static/blog/<locked-slug>/index.html
```

Expected: `0` — 본문 중간 텍스트가 HTML 에 없음 (제대로 잘림).

- [ ] **Step 4: Commit**

```bash
git add src/pages/blog/[...slug].astro
git commit -m "feat(gating): 잠긴 카테고리 글 티저 분기 — [...slug].astro"
```

---

## Task 6: /subscribe — 가치제안 풀랜딩 페이지

**Files:**
- Create: `src/pages/subscribe.astro`

- [ ] **Step 1: 페이지 작성**

`src/pages/subscribe.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { CATEGORIES, STIBEE } from '../consts';
import { getCollection } from 'astro:content';

const lockedCategorySlugs = ['market-forecast', 'stock-analysis'];
const lockedCategories = CATEGORIES.filter((c) => lockedCategorySlugs.includes(c.slug));

const fromSlug = Astro.url.searchParams.get('from') ?? '';
const fromCategory = Astro.url.searchParams.get('category') ?? '';

// 무료 카테고리 최근 글 3편 — "이런 깊이로 분석합니다" 샘플용
const allPosts = await getCollection('blog');
const sampleFreePosts = allPosts
  .filter((p) => ['daily-brief', 'economy-issue'].includes(p.data.category))
  .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
  .slice(0, 3);

const stibeeUrl = STIBEE.SUBSCRIBE_URL;
---

<BaseLayout
  title="구독하기 — Lincoln Brief"
  description="시장 예측·종목 분석 글을 메일로 받아보세요. 무료."
>
  <article class="bg-ink-900">
    <!-- HERO -->
    <header class="relative overflow-hidden border-b border-ink-600">
      <div
        class="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style="background: linear-gradient(90deg, transparent, #d8b878, transparent);"
        aria-hidden="true"
      ></div>
      <div class="container-x py-20 md:py-28">
        <div class="mx-auto max-w-2xl text-center">
          <p class="text-[11px] uppercase tracking-widest-2 text-gold-400">Premium · 무료 구독</p>
          <h1 class="mt-6 font-serif text-4xl font-normal leading-tight text-ink-50 md:text-5xl">
            매주 받아보는<br/>4편의 시장 분석
          </h1>
          <p class="mx-auto mt-8 max-w-xl font-serif text-lg italic leading-relaxed text-ink-100">
            거시·섹터 흐름과 개별 종목 펀더멘털을 Lincoln 이 직접 정리합니다.<br/>
            매주 월·목 오전, 두 분야의 글이 메일로 도착합니다.
          </p>
        </div>
      </div>
    </header>

    <!-- 두 카테고리 소개 -->
    <section class="border-b border-ink-600 py-16">
      <div class="container-x">
        <div class="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          {lockedCategories.map((cat) => (
            <div class="border border-ink-600 bg-ink-950 p-8">
              <div
                class="mb-4 h-px w-12"
                style={`background: ${cat.color};`}
              ></div>
              <h2 class="font-serif text-2xl text-ink-50">{cat.name}</h2>
              <p class="mt-3 text-sm text-ink-200">{cat.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <!-- 무엇을 받는가 -->
    <section class="border-b border-ink-600 py-16">
      <div class="container-x">
        <div class="mx-auto max-w-2xl">
          <p class="eyebrow text-center text-gold-400">발송 일정</p>
          <h2 class="mt-4 text-center font-serif text-3xl text-ink-50">매주 월·목 오전</h2>
          <ul class="mx-auto mt-8 max-w-md space-y-3 text-ink-100">
            <li class="flex items-start gap-3">
              <span class="text-gold-400">●</span>
              <span><strong class="text-gold-400">시장 예측</strong> — 거시·섹터 단·중기 전망</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-gold-400">●</span>
              <span><strong class="text-gold-400">종목 분석</strong> — 관심 종목 펀더멘털·기술적 분석</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-gold-400">●</span>
              <span>각 글은 5-10분 분량 · 데이터 표·차트 포함</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-gold-400">●</span>
              <span>구독은 영구 무료 · 언제든 취소</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- 샘플 보기 (무료 카테고리 글) -->
    {sampleFreePosts.length > 0 && (
      <section class="border-b border-ink-600 py-16">
        <div class="container-x">
          <div class="mx-auto max-w-4xl">
            <p class="eyebrow text-center text-gold-400">샘플 보기</p>
            <h2 class="mt-4 text-center font-serif text-3xl text-ink-50">이런 깊이로 분석합니다</h2>
            <p class="mt-3 text-center text-sm text-ink-300">아래는 무료 공개 글입니다. 시장 예측·종목 분석도 동일한 기준으로 작성됩니다.</p>
            <div class="mt-10 grid gap-4 md:grid-cols-3">
              {sampleFreePosts.map((p) => (
                <a
                  href={`/blog/${p.slug}/`}
                  class="block border border-ink-600 bg-ink-950 p-6 transition hover:border-gold-500"
                >
                  <p class="text-[10px] uppercase tracking-widest-2 text-gold-400">{p.data.category}</p>
                  <p class="mt-2 font-serif text-base leading-snug text-ink-50">{p.data.title}</p>
                  <p class="mt-2 text-xs text-ink-300">{p.data.description}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>
    )}

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

    <!-- FAQ -->
    <section class="border-t border-ink-600 py-16">
      <div class="container-x">
        <div class="mx-auto max-w-2xl">
          <p class="eyebrow text-center text-gold-400">자주 묻는 질문</p>
          <dl class="mt-8 space-y-6 text-ink-100">
            <div>
              <dt class="font-serif text-lg text-ink-50">정말 무료인가요?</dt>
              <dd class="mt-2 text-sm text-ink-200">네. 시장 예측·종목 분석 두 카테고리 모두 영구 무료입니다.</dd>
            </div>
            <div>
              <dt class="font-serif text-lg text-ink-50">언제 메일이 오나요?</dt>
              <dd class="mt-2 text-sm text-ink-200">매주 월요일·목요일 오전. 각 요일에 두 분야의 새 글이 발송됩니다.</dd>
            </div>
            <div>
              <dt class="font-serif text-lg text-ink-50">메일이 안 와요</dt>
              <dd class="mt-2 text-sm text-ink-200">스팸함을 확인해주세요. Lincoln Brief 발신 주소를 주소록에 추가하시면 도착률이 올라갑니다.</dd>
            </div>
            <div>
              <dt class="font-serif text-lg text-ink-50">탈퇴하고 싶어요</dt>
              <dd class="mt-2 text-sm text-ink-200">모든 메일 하단의 "구독 취소" 링크 한 번으로 즉시 처리됩니다.</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  </article>
</BaseLayout>
```

- [ ] **Step 2: 시각 확인 (수동)**

```bash
npm run dev
```

브라우저:
- `http://localhost:4321/subscribe` — 풀랜딩 정상 렌더링
- `http://localhost:4321/subscribe?from=test-slug&category=market-forecast` — URL 파라미터 받아서 페이지 변동 없음 (현재는 표시 안 함, 추후 변경 가능)
- 잠긴 글에서 CTA 클릭 → `/subscribe?from=…` 도착 → 페이지 정상

Expected: 6개 섹션 (Hero / 카테고리 소개 / 발송일정 / 샘플 / 구독폼 / FAQ) 모두 노출. `STIBEE.SUBSCRIBE_URL` 비어있으면 "구독 폼 준비 중" 박스 표시. URL 채워지면 즉시 버튼 활성화.

- [ ] **Step 3: 빌드 통과 확인**

```bash
npm run build
```

Expected: `.vercel/output/static/subscribe/index.html` 생성됨.

- [ ] **Step 4: Commit**

```bash
git add src/pages/subscribe.astro
git commit -m "feat(landing): /subscribe — 가치제안 풀랜딩 페이지"
```

---

## Task 7: RSS — 잠긴 글 description 만 출력 (TDD 부분)

**Files:**
- Modify: `src/pages/rss.xml.js`
- Test: `tests/lib/gating.test.ts` (확장)

- [ ] **Step 1: RSS 빌더 헬퍼 함수 분리 + 테스트 추가**

`tests/lib/gating.test.ts` 끝에 다음 describe 블록 추가:

```typescript
import { rssItemForPost } from '../../src/lib/gating';

describe('rssItemForPost', () => {
  const basePost = {
    slug: 'foo',
    data: {
      title: 'T',
      description: '요약',
      pubDate: new Date('2026-01-01'),
      publishedAt: undefined,
    },
    body: '본문 첫 단락.\n\n본문 둘째 단락.\n\n본문 셋째 단락.',
  } as any;

  it('무료 카테고리 — description 그대로', () => {
    const item = rssItemForPost({ ...basePost, data: { ...basePost.data, category: 'daily-brief' } });
    expect(item.description).toBe('요약');
  });

  it('잠긴 카테고리 — description 에 "전체보기" 안내 추가', () => {
    const item = rssItemForPost({ ...basePost, data: { ...basePost.data, category: 'market-forecast' } });
    expect(item.description).toContain('요약');
    expect(item.description).toContain('전체 보기');
  });

  it('잠긴 카테고리 — link 는 절대 URL 아닌 슬러그 경로', () => {
    const item = rssItemForPost({ ...basePost, data: { ...basePost.data, category: 'stock-analysis' } });
    expect(item.link).toBe('/blog/foo/');
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/lib/gating.test.ts
```

Expected: FAIL — `rssItemForPost` not exported.

- [ ] **Step 3: gating.ts 에 rssItemForPost 추가**

`src/lib/gating.ts` 하단에 추가:

```typescript
export interface RssItem {
  title: string;
  description: string;
  pubDate: Date;
  link: string;
}

export function rssItemForPost(post: CollectionEntry<'blog'>): RssItem {
  const link = `/blog/${post.slug}/`;
  const baseDescription = post.data.description;
  const description = isLocked(post)
    ? `${baseDescription}\n\n— 전체 보기는 구독 후 가능합니다.`
    : baseDescription;
  return {
    title: post.data.title,
    description,
    pubDate: post.data.publishedAt ?? post.data.pubDate,
    link,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test
```

Expected: 전체 테스트 11개 (gating 5 + teaser 8 + rssItemForPost 3) 모두 PASS. (gating 원래 5개 + 신규 3개 = 8개, teaser 8개, 총 16개)

- [ ] **Step 5: rss.xml.js 가 헬퍼 사용하도록 수정**

`src/pages/rss.xml.js` 를 다음으로 교체:

```javascript
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';
import { rssItemForPost } from '../lib/gating';

export async function GET(context) {
  const posts = await getCollection('blog');
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: posts
      .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
      .map(rssItemForPost),
  });
}
```

- [ ] **Step 6: 빌드 확인 + RSS 출력 점검**

```bash
npm run build
```

Expected: 빌드 성공. `.vercel/output/static/rss.xml` 생성. 파일 안에서 잠긴 카테고리 글 1편 골라 `<description>` 검사:

```bash
grep -A 1 "잠긴 글 제목 일부" .vercel/output/static/rss.xml | head -5
```

Expected: description 에 "전체 보기는 구독 후 가능합니다" 문자열 포함. 본문 (잠긴 글의 첫 3단락 텍스트) 은 RSS 에 없음.

- [ ] **Step 7: Commit**

```bash
git add src/lib/gating.ts tests/lib/gating.test.ts src/pages/rss.xml.js
git commit -m "feat(rss): 잠긴 카테고리 글은 description 에 구독 안내만"
```

---

## Task 8: PostCard.astro — 잠금 아이콘 표시

**Files:**
- Modify: `src/components/PostCard.astro`

- [ ] **Step 1: 현재 컴포넌트 확인**

```bash
```

먼저 파일 내용 읽기:

```bash
cat src/components/PostCard.astro
```

- [ ] **Step 2: 카드 제목 옆에 🔒 아이콘 추가**

`src/components/PostCard.astro` 상단 frontmatter 에서 `isLocked` 임포트 추가:

```astro
---
// 기존 import 들 아래에 추가
import { isLocked } from '../lib/gating';

// 기존 props 처리 후
const locked = isLocked(post);
---
```

카드 제목 렌더링 위치에 잠금 표시 삽입 (제목 앞에 작은 자물쇠 이모지 + 시각적 표시):

```astro
<h3 class="...기존 클래스...">
  {locked && (
    <span
      class="mr-2 inline-block text-xs text-gold-400"
      title="구독자 전용"
      aria-label="구독자 전용 콘텐츠"
    >🔒</span>
  )}
  {post.data.title}
</h3>
```

> 정확한 `<h3>` 위치는 기존 컴포넌트 구조에 맞춰 수정 — 제목이 어떤 태그든 그 안쪽 앞에 `{locked && (...)}` 블록 삽입.

- [ ] **Step 3: 시각 확인 (수동)**

```bash
npm run dev
```

브라우저:
- 홈 `http://localhost:4321/` — 시장예측·종목분석 카테고리 글 카드에 🔒 표시 보임
- 데일리·경제 글 카드는 표시 없음
- `http://localhost:4321/category/market-forecast` — 모든 카드에 🔒

Expected: 잠긴 카테고리 글에만 자물쇠 노출.

- [ ] **Step 4: Commit**

```bash
git add src/components/PostCard.astro
git commit -m "feat(card): 잠긴 카테고리 글 카드에 🔒 표시"
```

---

## Task 9: 최종 빌드·전체 테스트·수동 E2E 검증

**Files:** 검증 전용 — 코드 변경 없음.

- [ ] **Step 1: 전체 단위 테스트 실행**

```bash
npm test
```

Expected: 모든 테스트 PASS (gating 8개 + teaser 8개 = 16개).

- [ ] **Step 2: 프로덕션 빌드**

```bash
npm run build
```

Expected: 빌드 성공. `Lighthouse-ready` 출력 또는 오류 없이 완료.

- [ ] **Step 3: 빌드 산출물 sanity check**

```bash
# 잠긴 글 HTML 에 전체 본문이 누출되지 않았는지 확인
# 1) 잠긴 글 1편 선택
ls .vercel/output/static/blog/ | head -20

# 2) 그 글 .md 원본의 마지막 단락 일부 텍스트를 찾는다 (이 텍스트는 잠금 후 HTML 에 없어야 함)
# 잠긴 글의 본문 4번째 단락 이후 임의 한 구절을 골라 grep
grep -c "<선택한 본문 후반부 문장>" .vercel/output/static/blog/<locked-slug>/index.html
```

Expected: `0` — 본문 후반부 문장이 빌드된 HTML 에 없음.

- [ ] **Step 4: 미리보기 서버에서 수동 E2E**

```bash
npm run preview
```

브라우저 시나리오 (각 단계 확인):

1. `http://localhost:4321/` — 홈 카드에 일부 글은 🔒
2. 🔒 글 카드 클릭 → `/blog/<slug>` → 첫 3단락 + 페이드 + CTA
3. CTA "무료 구독 시작" 클릭 → `/subscribe?from=<slug>&category=…`
4. /subscribe 풀랜딩 → Hero / 카테고리 / 발송일정 / 샘플 3편 / 구독폼 / FAQ
5. 무료 카테고리 글 (예: daily-brief) → 전체 본문 정상 (잠금 분기 안 탐)
6. `http://localhost:4321/rss.xml` → 잠긴 글의 `<description>` 에 "전체 보기는 구독 후" 안내 포함
7. 카테고리 페이지 `/category/market-forecast` → 모든 카드 🔒

Expected: 모두 정상.

- [ ] **Step 5: Commit (선택 — 빌드 산출물 정리 등 변경 사항 있을 때만)**

검증 단계에서 코드 변경 없으면 별도 커밋 없음.

- [ ] **Step 6: Phase 1 마무리 — 머지/배포 결정**

main 브랜치 작업이면 `git push` 로 즉시 Vercel 배포. 별도 브랜치라면 PR 생성:

```bash
git push origin main
# OR
gh pr create --title "Phase 1: 구독 게이팅 + /subscribe 랜딩 + RSS 티저" --body "..."
```

Expected: Vercel 자동 배포 → 프로덕션 URL 에서 동일 E2E 시나리오 1-7 검증.

---

## Self-Review

**Spec 커버리지 점검 (spec 2026-05-20-subscription-gating-design.md 대조):**

- §1 카테고리 정책 → Task 2 `LOCKED_CATEGORIES`
- §2 사용자 흐름 (게스트→잠긴 글→티저→/subscribe) → Task 5 + 6
- §3 아키텍처 — middleware → **Phase 1 범위 밖 (인증 없음). [...slug].astro 분기로 대체**
- §3 파일 구조 — Phase 1 파일들: `gating.ts`/`teaser.ts`/`PaywallTeaser.astro`/`subscribe.astro` ✓
- §4 PaywallTeaser → Task 4
- §4 SubscribeForm → **Phase 1 범위 밖 (Magic Link 폼 없음). Stibee URL 버튼으로 대체**
- §4 /subscribe 페이지 → Task 6
- §4 /account → **Phase 2**
- §5 SEO — meta/title 그대로, 본문만 잘림 ✓ Task 5 Step 3 확인 절차
- §5 RSS 정책 — Task 7 ✓
- §5 자동화·Keystatic — 영향 없음 ✓ (코드 변경 없음)
- §5 PostCard 잠금 표시 — Task 8 ✓
- §6 보안 — Phase 1 인증 없으므로 토큰·세션·CSRF·rate limit 전부 **Phase 2**
- §7 Phase 1 정의와 일치 ✓
- §8 테스트 — 단위 (Vitest) + 수동 E2E 모두 포함 ✓

**Placeholder 점검:** "본문 중간 텍스트" 같은 표현은 검증 단계에서 실제 문장으로 대체해야 하는 placeholder — 의도적 placeholder (실행자가 본인 데이터로 채우는 부분). "TBD"/"TODO"/"implement later" 없음.

**타입 일관성:** `isLocked(post)` · `extractTeaserParagraphs(md, count?)` · `renderTeaserHtml(paragraphs)` · `rssItemForPost(post)` — 시그니처 모든 task 에서 일치 ✓.

**Phase 1 범위 명시적 제외:**
- 회원 인증 (Magic Link, 세션, KV) → Phase 2
- /account 페이지 → Phase 2
- middleware.ts (게이팅용) → Phase 2 (Phase 1 은 정적 빌드 시 카테고리 기반 분기로 충분)
- Rate limit · CSRF · 토큰 보안 → Phase 2
- /privacy · /terms 정적 페이지 → Phase 2 후속
