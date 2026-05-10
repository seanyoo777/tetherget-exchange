import type express from "express";
import { PLATFORM_API_VERSION, PlatformHttpHeaders } from "@tetherget/contracts";

/** 성공·데이터 JSON 응답에도 API 버전 헤더를 붙인다. */
export function platformApiVersionJsonMiddleware(
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const origJson = res.json.bind(res);
  res.json = function jsonWithPlatformVersion(body: unknown) {
    res.setHeader(PlatformHttpHeaders.API_VERSION, PLATFORM_API_VERSION);
    return origJson(body);
  };
  next();
}
