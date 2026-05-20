# 구독 게이팅 + Magic Link 인증 — 설계 문서

**작성일:** 2026-05-20
**상태:** 초안 (사용자 리뷰 대기)
**범위:** 카테고리 단위 콘텐츠 게이팅 · 광고/구독 랜딩 페이지 · Magic Link 기반 회원/구독 통합 시스템
**관련 프로젝트:** Lincoln Brief (Astro 4.16 hybrid + Vercel serverless + Node 20)

---

## 1. 목적과 비즈니스 컨텍스트

Lincoln Brief 는 현재 4개 카테고리 (데일리시황 · 경제이슈 · 시장예측 · 종목분석) 의 모든 글을 무료 공개한다. 이 설계는 두 카테고리를 구독자 전용으로 전환해 (1) 메일 구독자 유입 경로를 만들고 (2) 향후 본문 메일 자동 발송 (Stibee 연동) 의 기반이 되는 회원·세션 인프라를 구축하는 것이 목표다.

### 카테고리 정책 (확정)

| 카테고리 | slug | 게이팅 | 노출 정책 |
|---------|------|--------|----------|
| 데일리 시황 | `daily-brief` | ❌ 무료 | 전체 본문 누구나 공개 |
| 경제 이슈 | `economy-issue` | ❌ 무료 | 전체 본문 누구나 공개 |
| 시장 예측 | `market-forecast` | 🔒 잠금 | 비로그인: 티저만. 로그인: 전체 본문 |
| 종목 분석 | `stock-analysis` | 🔒 잠금 | 비로그인: 티저만. 로그인: 전체 본문 |

---

## 2. 사용자 흐름

### 게스트가 잠긴 글 접근

```
1. 홈/카테고리/검색에서 잠긴 글 카드 클릭 (제목·요약·발행일 정상 노출)
2. /blog/<slug> 진입 → middleware 가 게이팅 판정
3. 잠긴 글 + 비로그인 → 티저 렌더링 (첫 2-3문단 + 페이드 + CTA)
4. CTA "무료 구독 시작" → /subscribe?from=<slug> 이동
5. /subscribe 랜딩: 가치제안 + 이메일 입력 폼
6. POST /api/auth/magic-link → 메일 발송 ("로그인 링크가 전송되었습니다")
7. 사용자 메일함 → 링크 클릭
8. GET /api/auth/verify?token=… → 세션 발급 + 302 → /blog/<원래 slug>
9. 본문 전체 열람
```

### 기존 구독자 재방문

```
1. 잠긴 글 카드 클릭 → /blog/<slug>
2. middleware 가 세션 쿠키 검증 → 유효
3. 본문 전체 렌더링 (티저 분기 안 탐)
```

### 탈퇴

```
경로 A: 발송 메일 푸터 "구독 취소" 링크 → 1-클릭 토큰 URL → 즉시 삭제
경로 B: 로그인 상태에서 /account → "계정 삭제" 버튼 → 확인 후 즉시 삭제
```

---

## 3. 아키텍처

### 데이터 플로우

```
[Browser]
   │
   │ GET /blog/<slug>
   ▼
[Astro middleware.ts]
   │ 1. frontmatter.category 확인
   │ 2. LOCKED_CATEGORIES 포함 여부
   │ 3. 세션 쿠키 검증
   │
   ├─ 무료 카테고리 OR 로그인 → 정적 페이지 그대로
   └─ 잠금 + 비로그인 → context.locals.locked = true
   │
   ▼
[blog/[...slug].astro]
   │ locked? → PaywallTeaser 컴포넌트
   └ unlocked? → 전체 본문
```

### 인증 플로우

```
POST /api/auth/magic-link
  body: { email }
  - email 형식 검증
  - 토큰 = nanoid(32)
  - KV: SET magic-link:<token> = {email, exp: now+15min} EX 900
  - Resend: send({ to: email, subject, body: "<SITE_URL>/api/auth/verify?token=<token>&next=<slug>" })
  - 200 { ok: true }

GET /api/auth/verify?token=…&next=<slug>
  - KV: GET magic-link:<token>
  - 만료/없음 → 400
  - KV: DEL magic-link:<token> (1회용)
  - KV: SET users:<email> = {createdAt, lastSeenAt} (upsert)
  - 세션 ID = nanoid(32)
  - KV: SET session:<sid> = {email} EX 2592000 (30일)
  - Set-Cookie: lb_session=<sid>; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000
  - 302 Location: <next> | /

POST /api/auth/logout
  - 쿠키 sid 추출
  - KV: DEL session:<sid>
  - Set-Cookie: lb_session=; Max-Age=0
  - 302 Location: /
```

### 파일 구조 (신규/수정)

```
src/
├── middleware.ts                          ← 신규: 세션 확인 + 게이팅 판정
├── lib/
│   ├── auth/
│   │   ├── session.ts                     ← 신규: 쿠키 발급·검증·삭제
│   │   ├── magic-link.ts                  ← 신규: 토큰 발급·메일 발송
│   │   ├── kv.ts                          ← 신규: @vercel/kv 래퍼
│   │   └── email-template.ts              ← 신규: 로그인 메일 본문 (HTML+텍스트)
│   └── gating.ts                          ← 신규: LOCKED_CATEGORIES 상수 + isLocked()
├── pages/
│   ├── subscribe.astro                    ← 신규: 가치제안 풀랜딩
│   ├── login.astro                        ← 신규: Magic Link 폼 단독 (이미 회원)
│   ├── account.astro                      ← 신규: 계정 설정 (이메일 + 탈퇴)
│   ├── api/auth/
│   │   ├── magic-link.ts                  ← 신규: POST 토큰 발급
│   │   ├── verify.ts                      ← 신규: GET 토큰 검증·세션 발급
│   │   ├── logout.ts                      ← 신규: POST 세션 삭제
│   │   └── delete-account.ts              ← 신규: POST 사용자 + 세션 삭제
│   ├── blog/[...slug].astro               ← 수정: 티저 분기 추가
│   └── rss.xml.js                         ← 수정: 잠긴 글 description 잘라내기
├── components/
│   ├── PaywallTeaser.astro                ← 신규: 페이드 + CTA
│   └── SubscribeForm.astro                ← 신규: Magic Link 입력 폼
└── consts.ts                              ← 수정: LOCKED_CATEGORIES 상수 추가
```

### 데이터 모델 (Vercel KV)

| Key 패턴 | Value | TTL |
|---------|-------|-----|
| `magic-link:<token>` | `{email, exp}` | 15분 |
| `session:<sid>` | `{email}` | 30일 |
| `users:<email>` | `{createdAt, lastSeenAt}` | 없음 (영구) |
| `unsubscribe:<token>` | `{email}` | 30일 |

> 향후 유료 도입 시 `users:<email>.plan` 필드 추가 — 현재는 미포함 (영구 무료 정책).

### 환경변수 (신규)

```
KV_REST_API_URL          # Vercel KV 통합 시 자동 주입
KV_REST_API_TOKEN        # 동상
RESEND_API_KEY           # Resend 도메인 인증 후 발급
SITE_URL                 # https://lincoln-brief.vercel.app — 메일 절대 URL
MAIL_FROM                # "Lincoln Brief <hello@lincoln-brief.com>"
```

> 세션 쿠키는 random opaque token (KV 조회 기반). HMAC 서명용 별도 시크릿 불필요.

---

## 4. 컴포넌트 설계

### `PaywallTeaser.astro`

**Props:** `title`, `pubDate`, `category`, `teaser` (첫 2-3문단 HTML), `slug`

**렌더링:**
- 제목 + 발행일 + 카테고리 뱃지
- `teaser` HTML 그대로 표시
- 하단 페이드 그라데이션 (CSS linear-gradient)
- CTA 박스: "🔒 이 글은 구독자 전용입니다 / 무료 구독 시작 →" → `/subscribe?from=<slug>`

### `SubscribeForm.astro`

**Props:** `from` (선택, 잠긴 글 slug)

**동작:**
- `<form action="/api/auth/magic-link" method="POST">`
- email input + submit 버튼
- 제출 후 JS fetch → 성공 시 "메일함을 확인해주세요" 인라인 메시지로 폼 대체
- JS 비활성 시 일반 POST → 응답 페이지로 이동

### `/subscribe` 페이지 (가치제안 풀랜딩)

섹션 순서:
1. **헤로**: "매주 받아보는 4편의 분석 — Lincoln"
2. **두 카테고리 소개**: 📊 시장 예측 (거시·섹터) · 📈 종목 분석 (펀더멘털)
3. **무엇을 받는가**: 발송 일정 (월·목) + 분량 + 형식
4. **샘플 보기**: 무료 카테고리 (데일리·경제) 최근 글 3개 카드 — "이런 깊이로 분석합니다"
5. **구독 폼**: `<SubscribeForm />`
6. **FAQ**: 무료인지 / 메일 도착 안 할 때 / 탈퇴 방법

**사회적 증거 숫자는 표기하지 않음** (결정 사항 — 발송 빈도·카탈로그로 대체).

### `/account` 페이지

- 로그인 필수 (middleware 가드)
- 현재 가입 이메일 표시
- "로그아웃" 버튼 → POST `/api/auth/logout`
- "계정 삭제" 버튼 → 확인 다이얼로그 → POST `/api/auth/delete-account` → 즉시 삭제

---

## 5. SEO · RSS · 자동화 영향

### SEO / 검색 노출

- 잠긴 글의 `<title>`, `<meta description>` 은 정상 노출 — 검색엔진 인덱싱 유지
- 본문은 티저 (첫 2-3문단) 만 HTML 에 존재 → 게스트와 크롤러가 보는 내용 동일 (cloaking 아님, Google First Click Free 호환)
- 카테고리 페이지 (`/category/<slug>`) 도 카드 단위 노출 정상

### RSS 정책 (`/rss.xml`)

- 잠긴 카테고리 글: `<description>` 을 첫 2-3문단으로 자르고 "← 전체보기" 링크 (절대 URL) 추가
- 무료 카테고리 글: 기존대로 전체 본문 포함
- 분리 피드 (premium RSS) 는 만들지 않음 (Phase 4+ 검토)

### 자동 발행 파이프라인 (Claude Code Action)

- 영향 없음. `scripts/generation-prompt.md` 변경 불필요
- 카테고리 분류·frontmatter 동일. 게이팅은 렌더링 레이어 전용

### Keystatic CMS

- 영향 없음. 글 작성·수정 흐름 동일

### 홈페이지 (`src/pages/index.astro`)

- 잠긴 카테고리 글도 카드로 노출 (제목·요약·발행일·카테고리 배지)
- 클릭 시 `/blog/<slug>` → 티저로 진입

---

## 6. 보안 고려사항

| 항목 | 대책 |
|------|------|
| Magic Link 토큰 탈취 | 1회용 (검증 후 삭제) · 15분 만료 · HTTPS 전용 · `nanoid(32)` 충분한 엔트로피 |
| 세션 쿠키 탈취 | `HttpOnly` · `Secure` · `SameSite=Lax` · 30일 만료 |
| CSRF | 상태 변경 엔드포인트 (logout, delete-account) 는 `SameSite=Lax` 쿠키 + Origin 검증 |
| 이메일 enumeration | `/api/auth/magic-link` 응답 항상 200 (가입자/비가입자 동일) |
| Rate limit | KV 카운터: `ratelimit:magic-link:<ip>` 분당 5회 · `ratelimit:magic-link:<email>` 시간당 3회 |
| 토큰 전송 보안 | 메일 본문 plaintext + HTML 양쪽. 첨부 안 함. 외부 추적 픽셀 없음 |

---

## 7. 구현 로드맵 (Phase 1-2)

### Phase 1 — 티저 + 게이팅 + /subscribe 랜딩 (1-2일)

목표: 인증 없이 잠금 UX 만 검증. 폼 제출 시 Stibee 임베드로 임시 처리 (또는 단순 안내 페이지).

- `src/lib/gating.ts` + `LOCKED_CATEGORIES` 상수
- `src/middleware.ts` — 잠금 판정
- `src/pages/blog/[...slug].astro` — 티저 분기
- `src/components/PaywallTeaser.astro`
- `src/pages/subscribe.astro` — 가치제안 랜딩 (폼은 placeholder)
- `src/pages/rss.xml.js` — 티저만 RSS 출력

**검증:** 비로그인 사용자가 시장예측 글 클릭 → 티저 + 페이드 + CTA 보임. `/subscribe` 정상 렌더링.

### Phase 2 — Magic Link 인증 + 세션 + /account (2-3일)

- Vercel KV 통합 (대시보드에서 생성 + 환경변수 자동 주입)
- Resend 도메인 검증 + API 키
- `src/lib/auth/*` (kv, session, magic-link, email-template)
- `src/pages/api/auth/*` (4개 엔드포인트)
- `src/components/SubscribeForm.astro` — 폼 → API 연동
- `src/pages/login.astro` (이미 회원이면 이쪽)
- `src/pages/account.astro` — 탈퇴 포함
- middleware 에 세션 쿠키 검증 추가 → 잠금 해제
- Rate limit (KV 카운터)

**검증:** 이메일 입력 → 메일 도착 → 링크 클릭 → 자동 로그인 → 잠긴 글 전체 열람. /account 에서 탈퇴 가능.

### Phase 3 — 본문 메일 자동 발송 (별도 spec)

본 spec 범위 밖. 잠긴 글 발행 시 Stibee 캠페인 자동 생성 — 추후 별도 설계.

---

## 8. 테스트 전략

### 단위 테스트 (Vitest)

- `lib/gating.isLocked(post)` — 카테고리별 분기
- `lib/auth/session` — 쿠키 생성/검증/만료
- `lib/auth/magic-link` — 토큰 생성·검증·만료·재사용 방지

### 통합 테스트

- `POST /api/auth/magic-link` → KV 토큰 저장 확인 + Resend 호출 모킹
- `GET /api/auth/verify` → 유효 토큰 → 세션 발급 + 302 / 만료 토큰 → 400 / 재사용 → 400
- 미들웨어 → 잠긴 글 + 세션 없음 → `locals.locked = true`

### E2E 시나리오 (수동 검증)

1. 게스트 → 시장예측 글 → 티저만 보임
2. CTA 클릭 → /subscribe
3. 이메일 입력 → 메일 도착
4. 링크 클릭 → 원래 글로 리다이렉트 + 본문 전체 보임
5. 새 탭에서 동일 글 진입 → 본문 보임 (세션 유지)
6. /account → 탈퇴 → 다시 잠긴 글 → 티저로 복귀

---

## 9. 결정 보류 / 향후 검토

- **사회적 증거 표시 임계값**: 구독자 1,000+ 도달 시 "구독자 N명" 노출 여부 재검토
- **유료 전환**: 영구 무료 정책이나, 1년 후 광고·후원·유료 옵션 재검토. 데이터 모델에 `plan` 필드는 미포함
- **본문 메일 발송**: Phase 3 별도 spec — Stibee 트랜잭셔널 도입 또는 Resend 캠페인 검토
- **개인정보처리방침 + 이용약관**: Phase 2 완료 후 정적 페이지 추가. 표준 템플릿 + 본인 정보 채움
- **소셜 OAuth 추가**: 사용자 요청 누적 시 Kakao/Naver 추가 검토. Magic Link 기반 위에 부가 가능
- **RSS 분리 피드 (premium)**: 토큰 URL 기반 구독자 전용 풀텍스트 RSS — 사용자 요청 누적 시

---

## 10. 부록 — 최종 결정 요약 (9건)

| # | 항목 | 결정 |
|---|------|------|
| 1 | 카테고리 정책 | 데일리·경제 = 무료 / 시장예측·종목분석 = 잠금 |
| 2 | 잠긴 글 노출 | B — 티저 공개 (첫 2-3문단 + 페이드 + CTA) |
| 3 | 광고/샘플 페이지 | B — 가치제안 풀랜딩 (/subscribe) |
| 4 | 로그인 방식 | A — Magic Link |
| 5 | 메일 인프라 | A — Resend (단독, 6개월 후 재검토) |
| 6 | 사회적 증거 | B — 숨김 (발송 빈도·카탈로그로 대체) |
| 7 | RSS 정책 | A — 티저만 |
| 8 | 요금 정책 | A — 영구 무료 |
| 9 | 탈퇴 / PIPA | B — 메일 푸터 링크 + /account 페이지 |
