# shared (통합 전제 공유 계약)

## `contracts` (`@tetherget/contracts`)

npm 워크스페이스 패키지. 프론트(Vite 별칭)·백엔드가 동일 모듈을 참조한다.

- **API 버전**: `PLATFORM_API_VERSION` (`X-Platform-Api-Version` 헤더와 동일)
- **상관 ID**: `PlatformHttpHeaders.CORRELATION_ID` / `REQUEST_ID`, `newCorrelationId`, `resolveCorrelationId` — 프론트는 요청마다 ID 전송, 백엔드는 에코 및 `res.locals.correlationId`
- **에러 봉투**: `{ error: { code, message, details? } }`, `PlatformApiError`, `PlatformErrorCodes`
- **주문 상태**: `OrderStatus`

빌드 산출물은 `shared/contracts/dist/` (루트 `prepare` / `npm run build` 시 생성).

### Zod 스키마 (`@tetherget/contracts/schemas`)

프론트 번들에 `zod`를 넣지 않도록 메인 엔트리와 분리. 가져오기 예:

`import { orderSchema } from "@tetherget/contracts/schemas"`

포함: `loginSchema`, `orderSchema`, `withdrawalRequestSchema`, `haltBodySchema`, `symbolToggleSchema`, `simMidSchema` 및 대응 `*Body` 타입.

프론트에서는 `src/lib/api.ts`가 `LoginRequestBody`, `OrderCreateBody` 등을 **`export type`만** 재수출 — 번들에 zod 없음.

## 향후 확장

| 향후 패키지 | 역할 |
|-------------|------|
| `ids` | `user_id`, 주문/출금 ID 네임스페이스 상수 |
| `audit-types` | 구조화 로그·감사 이벤트 타입 정의 |

자세한 설계는 `docs/UNIFIED_PLATFORM_ARCHITECTURE.md` 를 참고한다.
