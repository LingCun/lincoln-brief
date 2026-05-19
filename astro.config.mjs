// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel/serverless';
import keystatic from '@keystatic/astro';

// NOTE: @astrojs/sitemap 3.x 가 현재 Astro 4.16 와 호환 이슈가 있어 일시 제거.
// 추후 Astro 6 마이그레이션 시 재추가.
// hybrid 모드: 페이지 기본 정적, /keystatic 어드민만 SSR.
export default defineConfig({
  site: 'https://lincolnbrief.com',
  output: 'hybrid',
  adapter: vercel(),
  integrations: [
    mdx(),
    tailwind({ applyBaseStyles: false }),
    react(),
    keystatic(),
  ],
});
