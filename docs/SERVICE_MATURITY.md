# 서비스 성숙도 — 목표(100%) 대비 현재

“완성형 중앙화 거래소·통합 플랫폼”을 **실서비스 수준**으로 두었을 때의 기준과, **지금 이 레포**의 위치를 정리한다.  
수치 100%는 없고, 아래를 채워 나가면 **운영 가능성**이 높아진다.

---

## 1. 목표 상태 (실서비스에 가깝게)

| 영역 | 기대 |
|------|------|
| **신원·세션** | 실제 JWT/OAuth2, 리프레시 토큰, 비밀번호 해시(bcrypt/argon2), 계정 잠금·2FA |
| **API 보안** | 역할은 **토큰 클레임만** 신뢰 (`x-role` 등 헤더 스푸핑 불가), Rate limit, WAF/방화벽 |
| **원장·지갑** | DB + 트랜잭션, 입출금·마진 **이중기록 방지**, 대사(reconciliation) |
| **매칭·주문** | 다중 인스턴스 일관성, 주문 ID 멱등, 체결 스트림, 진짜 오더북 |
| **시세** | 계약된 마켓 데이터 소스, 장애·지연 시 폴백 |
| **관측** | 구조화 로그 수집(SIEM), 메트릭·알림, 분산 추적 |
| **배포** | 헬스/레디 프로브, 무중단 배포, 시크릿 관리, 백업·복구 RPO/RTO |
| **컴플라이언스** | 감사 로그 보존, 개인정보·거래 보관 정책 |

---

## 2. 현재 상태 (이 레포)

| 영역 | 현재 |
|------|------|
| **UI** | Bitget 스타일 다중 화면, 스피드 패드, 관리자·지갑·주문 흐름 **데모 수준 완성도** |
| **API 계약** | `@tetherget/contracts`: 버전 헤더, 에러 봉투, 상관 ID, Zod 스키마(서브패스) |
| **백엔드** | Express 단일 프로세스, **JWT(HS256)** 로그인 토큰, 비밀번호 **scrypt** 해시 시드 유저, 개발 전용 시 **`mock-token-{id}`** 호환(운영·`STRICT_AUTH` 시 비활성) |
| **역할** | 개발 모드: `x-role` 헤더 허용 → **운영에서는 `STRICT_AUTH`/`NODE_ENV=production` 시 토큰만 신뢰** |
| **영속성** | `exchange-state.json` 파일 스냅샷, 재시작 복구 |
| **매칭** | 시뮬 미드·티커 기반 데모 엔진, 단일 노드 전제 |
| **배포** | Vercel SPA rewrite, Render/`render.yaml`, Dockerfile, CI, CORS 환경변수 |

---

## 3. 우선으로 채워야 할 간격 (요약)

1. **인증·인가 고도화** — 리프레시 토큰·키 로테이션·OAuth2·계정 잠금 등 (현재: JWT + 비밀번호 해시 + 로그인 rate limit).
2. **DB·원장** — PostgreSQL 등 + 마이그레이션, 출금/주문 원자적 처리.
3. **보안 하드닝** — Rate limit, Helmet, 비밀번호 정책, 운영 시 `CORS_ORIGINS` 고정.
4. **관측·프로브** — `/api/health`(버전) + `/api/ready`(디스크 쓰기 등), 로그 싱크.
5. **무중단·복구** — 파일 스냅샷 → DB 백업, 다중 인스턴스 시 상태 공유(레디스/큐 등).

---

## 4. 최근에 코드로 반영한 운영 준비 조각

- **`GET /api/ready`** — 상태 저장 디렉터리 쓰기 가능 여부 (레디 프로브용).
- **SIGTERM/SIGINT** — 매칭 타이머 중지 후 스냅샷 저장, 서버 종료.
- **`STRICT_AUTH=true` 또는 `NODE_ENV=production`** — Bearer 없이는 `x-role` 무시(TRADER로 처리).
- **JWT `JWT_SECRET`** — 운영에서 32자 이상 필수; 로그인 **`/api/auth/login`** 에 IP 기준 rate limit.
- **Helmet** — 기본 보안 HTTP 헤더 (JSON API는 CSP 비활성, CORS 크로스 오리진은 CORP `cross-origin`).
- **전역 API rate limit** — IP당 분당 `API_RATE_LIMIT_MAX` (기본 600), `GET /api/health|ready`·`OPTIONS` 제외.
- **`TRUST_PROXY`** — Render/Fly/Railway 자동 감지 또는 `TRUST_PROXY=1` 로 리버스 프록시 뒤 IP 인식.

---

## 관련 문서

- `docs/COMMON_DEVELOPMENT_PRINCIPLES.md`
- `docs/EXCHANGE_DEVELOPMENT_PRINCIPLES.md`
- `docs/UNIFIED_PLATFORM_ARCHITECTURE.md`
