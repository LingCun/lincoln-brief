import { defineCollection, z } from 'astro:content';
import { CATEGORIES } from '../consts';

const categorySlugs = CATEGORIES.map((c) => c.slug) as [string, ...string[]];

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    // SVG thumbnail URL (e.g. /thumbnails/daily-brief-20260514.svg)
    thumbnail: z.string().optional(),
    // Optional thumbnail tagline overlay (not used yet, future use)
    thumbnailCaption: z.string().optional(),
    category: z.enum(categorySlugs),
    // 한국/미국/글로벌 시장 라벨. 생략 시 slug·tags 기반 자동 추정.
    market: z.enum(['KR', 'US', 'GLOBAL']).optional(),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    readMinutes: z.number().optional(),
    sources: z.array(z.object({
      label: z.string(),
      url: z.string(),
    })).default([]),
  }),
});

export const collections = { blog };
