# API Key 발급 가이드

Lincoln Brief는 무료 공개 API 두 개를 씁니다.
KRX 키는 승인까지 ~1일, DART는 보통 수 시간 내.

---

## 1. DART (전자공시시스템)

상장 기업 공시·재무제표 조회용.

**가입 → 발급 절차:**
1. https://opendart.fss.or.kr 접속
2. 우상단 회원가입 → 이메일 인증
3. 로그인 → 마이페이지 → **인증키 신청**
4. 신청서 작성:
   - 활용 목적: "개인 금융 콘텐츠 (블로그) 작성용 시세·재무 데이터 조회"
   - 활용 분야: 기타
5. 보통 즉시 또는 수 시간 내 발급 (이메일 확인)

**키 받은 뒤:**
```bash
# .env 파일 (gitignored)
DART_API_KEY=발급받은_40자리_키
```

---

## 2. KRX OpenAPI (한국거래소)

코스피/코스닥 지수·종목·일별 매매 데이터용.

**가입 → 발급 절차:**
1. https://openapi.krx.co.kr 접속
2. 회원가입 (사업자번호 입력 안 해도 개인 발급 가능)
3. 로그인 → **API 신청** → "OpenAPI 이용 신청"
4. 신청서 작성:
   - 이용 목적: "개인 블로그/뉴스레터 시장 데이터 조회"
   - 이용 서비스: 필요한 API 체크 (지수, 종목 등)
5. **승인까지 보통 1영업일**. 이메일로 결과 통보.

**키 받은 뒤:**
```bash
# .env 파일
KRX_API_KEY=발급받은_키
```

---

## 3. Claude Code 에서 사용 (글쓰기 도우미)

`.env` 의 키를 Claude Code 가 자동으로 읽도록 설정:

### 옵션 A: 프로젝트 루트 `.env` (이미 .gitignore 됨)
```env
DART_API_KEY=...
KRX_API_KEY=...
```

### 옵션 B: 시스템 환경 변수 (영구)

**Windows (PowerShell):**
```powershell
[Environment]::SetEnvironmentVariable("DART_API_KEY", "your-key", "User")
[Environment]::SetEnvironmentVariable("KRX_API_KEY", "your-key", "User")
# 새 PowerShell 창 열어야 적용됨
```

이후 Claude Code 재시작하면 `.mcp.json` 의 `${DART_API_KEY}` `${KRX_API_KEY}` 가 자동 치환되어 korea-stock-mcp 가 활성화됩니다.

---

## 4. 자동화 (GitHub Actions) 에서 사용

GitHub repo 의 Settings → Secrets and variables → Actions →
**New repository secret** 으로 두 개 등록:
- `DART_API_KEY`
- `KRX_API_KEY`

이후 `.github/workflows/daily-brief.yml` 이 자동으로 읽어 매일 새벽 fetch.

---

## 5. 발급 전 임시 동작

KRX_API_KEY 가 없어도:
- `scripts/fetch-market.mjs` 는 **Yahoo Finance 의 ^KS11(KOSPI) / ^KQ11(KOSDAQ)** 로 폴백
- 지수 종가/등락률은 표시되지만, **외국인 매매·거래대금 등 KRX 고유 데이터는 비어있음**
- UI 는 자동으로 "데이터 대기" 표시

---

## 6. 키 분실 시

- DART: opendart.fss.or.kr 마이페이지에서 재발급
- KRX: openapi.krx.co.kr 마이페이지에서 재발급 (즉시)

---

## 7. 트러블슈팅

**"401 Unauthorized" 에러:**
- 키가 정확한지 확인
- KRX 의 경우 신청한 서비스 범위 안의 endpoint 인지 확인

**"Rate limit exceeded":**
- DART: 일 10,000회 제한
- KRX: 일 1,000회 제한 (확인 필요)
- 우리 cron 은 하루 1~2회만 호출 → 여유 충분
