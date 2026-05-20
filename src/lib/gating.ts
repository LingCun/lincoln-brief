import type { CollectionEntry } from 'astro:content';

export const LOCKED_CATEGORIES = ['market-forecast', 'stock-analysis'] as const;

export type LockedCategory = (typeof LOCKED_CATEGORIES)[number];

export function isLocked(post: CollectionEntry<'blog'>): boolean {
  return (LOCKED_CATEGORIES as readonly string[]).includes(post.data.category);
}

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
