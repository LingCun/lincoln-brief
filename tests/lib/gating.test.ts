import { describe, it, expect } from 'vitest';
import { isLocked, LOCKED_CATEGORIES, rssItemForPost } from '../../src/lib/gating';

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
