# Lincoln Brief — Docs

프로젝트 문서 진입점. 각 파일은 단일 책임.

## 운영 (현 시스템 동작)

| 파일 | 용도 |
|---|---|
| [AUTOMATION.md](AUTOMATION.md) | GitHub Actions 워크플로 인벤토리·데이터 흐름·프롬프트 체인 |
| [OPERATIONS.md](OPERATIONS.md) | 트러블슈팅·매일 모니터링·정기 유지보수 |
| [THUMBNAILS.md](THUMBNAILS.md) | 썸네일 작성 절차·base64 인라인·체크리스트 |
| [API_KEYS.md](API_KEYS.md) | DART·KRX 키 발급·환경변수 배치 |

## 제품 (사업 계획)

| 파일 | 용도 |
|---|---|
| [product/STRATEGY.md](product/STRATEGY.md) | 비전·타겟·가치 제안·차별화·리스크·의사결정 원칙 |
| [product/PRICING.md](product/PRICING.md) | 가격 책정·Phase 별 로드맵·KPI |
| [product/CONTENT_MODEL.md](product/CONTENT_MODEL.md) | 무료/유료 분리 규칙·워치리스트 포맷 |
| [product/LAUNCH.md](product/LAUNCH.md) | Phase 1 실행 체크리스트 (Week-by-week) |

## 진입점 권장

- 새 워크플로 실패 디버깅 → `OPERATIONS.md` §트러블슈팅
- 새 글 썸네일 작성 → `THUMBNAILS.md` §사진 스타일 워크플로
- 사업 모델 의사결정 → `product/STRATEGY.md` §의사결정 원칙
- 발송 시작 준비 → `product/LAUNCH.md`

> 단기 요약·컨벤션은 루트 [CLAUDE.md](../CLAUDE.md) 참고. 본 디렉토리는 디테일판.
