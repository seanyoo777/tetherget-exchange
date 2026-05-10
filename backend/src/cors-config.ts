import type { CorsOptions } from "cors";

/**
 * `CORS_ORIGINS` — 쉼표로 구분한 허용 출처 (예: Vercel 프론트 URL).
 * 비우면 개발 편의상 모든 출처 허용(기존 `cors()` 기본과 동일 취지).
 */
export function corsOptionsFromEnv(): CorsOptions | undefined {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) {
    return undefined;
  }
  const origins = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (origins.length === 0) {
    return undefined;
  }
  return {
    origin: origins.length === 1 ? origins[0] : origins,
    credentials: true
  };
}
