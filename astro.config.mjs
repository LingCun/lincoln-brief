// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';

// NOTE: @astrojs/sitemap 3.x 가 현재 Astro 4.16 와 호환 이슈가 있어 일시 제거.
// SEO 영향 있으나 RSS는 정상 동작. 추후 Astro 6 마이그레이션 시 재추가.
export default defineConfig({
  site: 'https://lincolnbrief.com',
  integrations: [
    mdx(),
    tailwind({ applyBaseStyles: false }),
  ],
});
