import { config, collection, fields } from '@keystatic/core';
import { CATEGORIES } from './src/consts';

const categoryOptions = CATEGORIES.map((c) => ({
  label: c.name,
  value: c.slug,
}));

const marketOptions = [
  { label: '🇰🇷 KR — 한국 시장', value: 'KR' },
  { label: '🇺🇸 US — 미국 시장', value: 'US' },
  { label: '🌐 GLOBAL — 거시·지정학', value: 'GLOBAL' },
];

export default config({
  /**
   * Storage: GitHub mode — 본인 깃헙 계정으로 로그인한 사용자만 편집 가능.
   * 로그인 후 깃헙 권한 모델로 자동 화이트리스트 (collaborator만 push 가능).
   */
  storage: {
    kind: 'github',
    repo: 'LingCun/lincoln-brief',
  },

  ui: {
    brand: { name: 'Lincoln Brief' },
  },

  collections: {
    blog: collection({
      label: '블로그 글',
      slugField: 'title',
      path: 'src/content/blog/*',
      format: { contentField: 'content' },
      entryLayout: 'content',
      columns: ['title', 'pubDate', 'category', 'market'],
      schema: {
        title: fields.slug({
          name: {
            label: '제목',
            validation: { length: { min: 1 } },
          },
        }),
        description: fields.text({
          label: '한 줄 요약',
          multiline: true,
          validation: { length: { min: 1 } },
        }),
        pubDate: fields.date({
          label: '발행일',
          validation: { isRequired: true },
        }),
        publishedAt: fields.text({
          label: '게시 시각 (ISO KST, 선택)',
          description: '예: 2026-05-21T06:32:15+09:00 — 비워두면 발행일만 표시',
        }),
        updatedDate: fields.date({
          label: '수정일 (선택)',
        }),
        thumbnail: fields.text({
          label: '썸네일 경로 (선택)',
          description: '예: /thumbnails/daily-brief-20260519.svg',
        }),
        thumbnailCaption: fields.text({
          label: '썸네일 캡션 (선택)',
        }),
        category: fields.select({
          label: '카테고리',
          options: categoryOptions,
          defaultValue: 'daily-brief',
        }),
        market: fields.select({
          label: '시장 라벨 (생략 가능, 자동 추정)',
          options: [
            { label: '— 자동 추정 —', value: '' },
            ...marketOptions,
          ],
          defaultValue: '',
        }),
        tags: fields.array(
          fields.text({ label: '태그' }),
          {
            label: '태그',
            itemLabel: (props) => props.value,
          },
        ),
        featured: fields.checkbox({
          label: '메인 Editor\'s Pick 으로 표시',
          defaultValue: false,
        }),
        readMinutes: fields.integer({
          label: '읽는 데 걸리는 시간 (분)',
        }),
        sources: fields.array(
          fields.object({
            label: fields.text({ label: '출처 이름' }),
            url: fields.url({ label: '출처 URL' }),
          }),
          {
            label: '참고 출처',
            itemLabel: (props) => props.fields.label.value,
          },
        ),
        content: fields.mdx({
          label: '본문 (마크다운)',
          extension: 'md',
          options: {
            image: { directory: 'public/images', publicPath: '/images/' },
          },
        }),
      },
    }),
  },
});
