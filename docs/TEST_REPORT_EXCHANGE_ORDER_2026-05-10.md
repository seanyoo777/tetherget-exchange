# 테스트 리포트 — 거래소 주문·운영 API (2026-05-10)

## 범위

- 백엔드: 주문 상태 세분화, 테이커 수수료 로그(`FEE_RECORDED`), 플랫폼 거래 정지, 심볼 거래 OFF, 공개 운영 상태 API.
- 프론트: 실거래 주문 후 서버 잔고 동기화, **LIMIT 접수(ACCEPTED)** 시 로컬 체결 연출 생략, 거래소 배너, 관리자 운영 패널, 주문 필터 확장.

## 자동 검증

| 항목 | 결과 |
|------|------|
| `backend`: `npm run build` (tsc) | 통과 |
| 루트: `npm run build` (tsc + vite) | 통과 |

## 수동 확인 권장 시나리오

1. **MARKET 실거래 주문** (로그인 트레이더): 체결 후 마이페이지 잔고가 서버 `getWallet`과 일치하는지.
2. **LIMIT 실거래 주문**: 응답 `ACCEPTED` 시 스피드 패널에 “체결” 알림이 뜨지 않고, 감사 로그에 접수만 남는지.
3. **관리자 → 플랫폼 거래 정지**: `/exchange` 배너 표시, 신규 주문 시 `TRADING_HALTED`.
4. **심볼 BTCUSDT OFF**: 현재 심볼 배너, 주문 시 `SYMBOL_DISABLED`.
5. **관리자 액션 로그**: `FEE_RECORDED`, `EXCHANGE_TRADING_HALT`, `EXCHANGE_SYMBOL_TOGGLE` 기록 여부.

## 영속화 (추가됨)

- 서버 종료 후에도 복구: `backend/data/exchange-state.json` 에 잔고·주문·출금 요청·거래 정지·심볼 차단·다음 ID 카운터 저장.
- 재시작 시 자동 로드; 파일 없으면 기본 시드 값 사용.

## 취소 API

- `POST /api/order/:id/cancel` — 상태가 `ACCEPTED` 인 주문만; 로그에 `ORDER_CANCEL_PENDING` → `ORDER_CANCELLED`, 증거금 환급.

## 매칭 엔진 (추가)

- 심볼별 **시뮬 중간가** `symbolMidPrices` — 파일에 저장, `GET /api/exchange/status` 의 `simMidPrices` 로 공개.
- **LIMIT** 주문이 가격 교차 시 부분 체결(`PARTIALLY_FILLED`) 또는 전체 체결(`FILLED`). 메이커 수수료 **2 bps** 별도 로그(`FEE_RECORDED`).
- 교차 규칙: **LONG** → `mid <= limit`, **SHORT** → `mid >= limit`.
- **관리자**: `POST /api/admin/exchange/sim-mid` `{ symbol, midUsdt }`, `POST /api/admin/exchange/match-once` 수동 1회.
- 백그라운드: 환경변수 **`MATCH_TICK_MS`** (기본 `8000`, `0` 이면 비활성).

## 알려진 한계

- 취소는 **LIMIT `ACCEPTED` 및 `PARTIALLY_FILLED`** (잔량 있음) 지원.
- 매칭은 **데모 시뮬 가격** 기준이며 실제 오더북과 무관.
