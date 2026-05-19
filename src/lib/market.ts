import type { CollectionEntry } from 'astro:content';

export type Market = 'KR' | 'US' | 'GLOBAL';

const KR_TAG_HINTS = [
  'KOSPI', 'KOSDAQ', '코스피', '코스닥',
  'USD/KRW', 'KRW', '환율', '원화',
  '한국은행', '한은', '외환시장',
  '삼성전자', 'SK하이닉스', '하이닉스',
];

const GLOBAL_SLUG_HINTS = ['trump-xi', 'oil-iran', 'global-', 'china-trade'];
const GLOBAL_TAG_HINTS = ['지정학', '글로벌', '중동', '미중', '트럼프', '시진핑'];

export function detectMarket(post: CollectionEntry<'blog'>): Market {
  if (post.data.market) return post.data.market;

  const slug = post.slug.toLowerCase();
  const tags = (post.data.tags ?? []).map((t) => t.toLowerCase());

  if (slug.startsWith('kr-')) return 'KR';
  if (KR_TAG_HINTS.some((t) => tags.includes(t.toLowerCase()))) return 'KR';

  if (GLOBAL_SLUG_HINTS.some((h) => slug.startsWith(h))) return 'GLOBAL';
  if (GLOBAL_TAG_HINTS.some((t) => tags.includes(t.toLowerCase()))) return 'GLOBAL';

  return 'US';
}

export const MARKET_META: Record<Market, { label: string; flag: string; color: string }> = {
  KR: { label: 'KR', flag: '🇰🇷', color: '#cd5c5c' },
  US: { label: 'US', flag: '🇺🇸', color: '#5677b0' },
  GLOBAL: { label: 'GLOBAL', flag: '🌐', color: '#9a8c70' },
};
