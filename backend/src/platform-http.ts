import type { Response } from "express";
import { buildErrorBody } from "@tetherget/contracts";

/** 통합 플랫폼 에러 봉투 — 클라이언트는 `error.code` 로 분기 가능. (`X-Platform-Api-Version` 헤더는 미들웨어가 부여) */
export function sendPlatformError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown
): Response {
  return res.status(status).json(buildErrorBody(code, message, details));
}
