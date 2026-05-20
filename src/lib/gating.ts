import type { CollectionEntry } from 'astro:content';

export const LOCKED_CATEGORIES = ['market-forecast', 'stock-analysis'] as const;

export type LockedCategory = (typeof LOCKED_CATEGORIES)[number];

export function isLocked(post: CollectionEntry<'blog'>): boolean {
  return (LOCKED_CATEGORIES as readonly string[]).includes(post.data.category);
}
