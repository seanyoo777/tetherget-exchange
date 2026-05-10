export { PLATFORM_API_VERSION } from "./version.js";
export {
  buildErrorBody,
  isPlatformErrorBody,
  PlatformApiError,
  platformApiVersionHeader,
  type PlatformErrorBody,
  type PlatformErrorPayload
} from "./error-envelope.js";
export { PlatformErrorCodes, type PlatformErrorCode } from "./error-codes.js";
export type { OrderStatus } from "./order-status.js";
export {
  PlatformHttpHeaders,
  newCorrelationId,
  resolveCorrelationId
} from "./http-headers.js";
