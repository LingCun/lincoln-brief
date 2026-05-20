import { describe, it, expect } from 'vitest';
import { extractTeaserParagraphs, renderTeaserHtml } from '../../src/lib/teaser';

describe('extractTeaserParagraphs', () => {
  it('첫 3개 단락 반환 (기본)', () => {
    const md = '첫번째 단락.\n\n두번째 단락.\n\n세번째 단락.\n\n네번째 단락.';
    expect(extractTeaserParagraphs(md)).toEqual([
      '첫번째 단락.',
      '두번째 단락.',
      '세번째 단락.',
    ]);
  });

  it('단락 수가 부족하면 있는 만큼만', () => {
    const md = '하나뿐인 단락.';
    expect(extractTeaserParagraphs(md)).toEqual(['하나뿐인 단락.']);
  });

  it('빈 줄 여러 개도 정상 처리', () => {
    const md = '하나.\n\n\n\n둘.';
    expect(extractTeaserParagraphs(md)).toEqual(['하나.', '둘.']);
  });

  it('마크다운 헤더는 단락에서 제외', () => {
    const md = '# 제목\n\n첫 단락.\n\n두번째.';
    expect(extractTeaserParagraphs(md)).toEqual(['첫 단락.', '두번째.']);
  });

  it('count 옵션 지원', () => {
    const md = 'A.\n\nB.\n\nC.\n\nD.';
    expect(extractTeaserParagraphs(md, 2)).toEqual(['A.', 'B.']);
  });
});

describe('renderTeaserHtml', () => {
  it('단락 배열을 <p> 태그로 감싼 HTML 반환', () => {
    const html = renderTeaserHtml(['첫째.', '둘째.']);
    expect(html).toContain('<p>첫째.</p>');
    expect(html).toContain('<p>둘째.</p>');
  });

  it('마크다운 인라인 강조 변환', () => {
    const html = renderTeaserHtml(['**굵게** 표시.']);
    expect(html).toContain('<strong>굵게</strong>');
  });

  it('단락 안에 링크가 있으면 변환', () => {
    const html = renderTeaserHtml(['[링크](https://example.com) 입니다.']);
    expect(html).toContain('<a href="https://example.com">링크</a>');
  });
});
