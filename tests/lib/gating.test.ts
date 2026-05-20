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
