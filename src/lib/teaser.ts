import { marked } from 'marked';

export function extractTeaserParagraphs(markdown: string, count = 3): string[] {
  return markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0 && !block.startsWith('#'))
    .slice(0, count);
}

export function renderTeaserHtml(paragraphs: string[]): string {
  return paragraphs
    .map((p) => marked.parseInline(p))
    .map((html) => `<p>${html}</p>`)
    .join('\n');
}
