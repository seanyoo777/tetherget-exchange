import { PLATFORM_API_VERSION } from "./version.js";

export type PlatformErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

/** 모든 플랫폼 HTTP 에러 본문 형태 — 성공 응답과 구분되는 단일 봉투. */
export type PlatformErrorBody = {
  error: PlatformErrorPayload;
};

export function buildErrorBody(code: string, message: string, details?: unknown): PlatformErrorBody {
  const payload: PlatformErrorPayload = { code, message };
  if (details !== undefined) {
    payload.details = details;
  }
  return { error: payload };
}

export function isPlatformErrorBody(value: unknown): value is PlatformErrorBody {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const err = v.error;
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  return typeof e.code === "string" && typeof e.message === "string";
}

/** 프론트에서 `fetch` 실패 시 구조화된 예외로 사용. */
export class PlatformApiError extends Error {
  override readonly name = "PlatformApiError";

  constructor(
    public readonly httpStatus: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function platformApiVersionHeader(): Record<string, string> {
  return { "X-Platform-Api-Version": PLATFORM_API_VERSION };
}
