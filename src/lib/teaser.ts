import { marked } from 'marked';

export function extractTeaserParagraphs(markdown: string, count = 3): string[] {
  return markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0 && !block.startsWith('#'))
    .slice(0, count);
}

// 콘텐츠 신뢰 모델: 모든 포스트는 단일 작성자가 직접 작성하거나
// 신뢰된 자동화로 생성됨 (Keystatic / 자동 발행 파이프라인 / 직접 .md 편집).
// 사용자 제출 콘텐츠 없음 → marked 출력에 별도 sanitize 안 함.
// 외부 입력이 본문에 섞이는 경우가 생기면 DOMPurify 추가 필요.
export function renderTeaserHtml(paragraphs: string[]): string {
  return paragraphs
    .map((p) => marked.parseInline(p))
    .map((html) => `<p>${html}</p>`)
    .join('\n');
}
