import type express from "express";
import { PlatformHttpHeaders, resolveCorrelationId } from "@tetherget/contracts";

/**
 * 요청의 `X-Correlation-Id` 또는 `X-Request-Id`를 받아 응답에 에코한다.
 * 없으면 서버가 새 ID를 발급한다 — 분산 추적·로그 상관에 사용.
 */
export function correlationIdMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const raw =
    req.get(PlatformHttpHeaders.CORRELATION_ID) ??
    req.get(PlatformHttpHeaders.REQUEST_ID) ??
    undefined;
  const id = resolveCorrelationId(raw);
  res.locals.correlationId = id;
  res.setHeader(PlatformHttpHeaders.CORRELATION_ID, id);
  next();
}
