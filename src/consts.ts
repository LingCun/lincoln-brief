export const SITE_TITLE = 'Lincoln Brief';
export const SITE_DESCRIPTION = '매일 아침, 미국·한국 증시 브리핑 — 시황·종목·예측·이슈';
export const SITE_URL = 'https://lincoln-brief.com';
export const AUTHOR = 'Lincoln';

// Stibee 메일 구독 폼 — 가입 후 발급받는 URL/ID 를 여기에 채우면 즉시 작동.
// 가입: https://stibee.com/  (구독자 500명까지 무료)
// 1) 발행 페이지 만들기 → 2) 구독 폼 만들기 → 3) 폼 공개 URL 또는 임베드 폼 ID 복사
//
//  - SUBSCRIBE_URL: Stibee 가 호스팅하는 구독 페이지 URL (예: https://page.stibee.com/subscriptions/123456)
//  - 비워두면 페이지에 "준비 중" 박스가 표시됩니다.
export const STIBEE = {
  SUBSCRIBE_URL: '', // 예: 'https://page.stibee.com/subscriptions/XXXXXX'
} as const;

export const CATEGORIES = [
  {
    slug: 'daily-brief',
    name: '데일리 시황',
    description: '매일 아침 미국·한국 증시 핵심 요약',
    color: '#d8b878', // gold
  },
  {
    slug: 'stock-analysis',
    name: '종목 분석',
    description: '관심 종목 펀더멘털·기술적 분석',
    color: '#5677b0', // blue
  },
  {
    slug: 'market-forecast',
    name: '시장 예측',
    description: '거시·섹터 흐름 기반 단·중기 전망',
    color: '#d96552', // red (coral)
  },
  {
    slug: 'economy-issue',
    name: '경제 이슈',
    description: '금리·환율·정책·글로벌 이벤트',
    color: '#7a8c5a', // sage
  },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]['slug'];
