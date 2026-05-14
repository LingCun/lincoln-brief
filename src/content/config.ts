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
