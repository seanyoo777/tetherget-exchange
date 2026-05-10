/** 플랫폼 HTTP 헤더 이름 — 서비스 간·클라이언트와 동일 문자열 사용. */
export const PlatformHttpHeaders = {
  API_VERSION: "X-Platform-Api-Version",
  CORRELATION_ID: "X-Correlation-Id",
  REQUEST_ID: "X-Request-Id"
} as const;

const CID_RX = /^[\x21-\x7E]{1,128}$/;

/** 요청에서 들어온 상관 ID를 정규화하거나, 없으면 새로 만든다 (전달·로깅용). */
export function resolveCorrelationId(headerValue: string | undefined): string {
  const s = headerValue?.trim();
  if (s && CID_RX.test(s)) {
    return s;
  }
  return newCorrelationId();
}

/** 브라우저·Node(Web Crypto)에서 UUID, 없으면 짧은 난수 문자열. */
export function newCorrelationId(): string {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
