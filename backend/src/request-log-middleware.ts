import type express from "express";

/**
 * 응답 종료 시 한 줄 구조화 로그 — `correlationIdMiddleware` 다음에 둔다.
 * 포맷: `[cid] METHOD path status ms`
 */
export function requestLogMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const start = Date.now();
  res.on("finish", () => {
    const cid = res.locals.correlationId ?? "-";
    const path = req.originalUrl ?? req.url;
    const ms = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log(`[${cid}] ${req.method} ${path} ${res.statusCode} ${ms}ms`);
  });
  next();
}
