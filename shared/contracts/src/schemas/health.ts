import { z } from "zod";

/** GET /api/health 본문 — 서버가 추가 필드를 넣어도 클라이언트 파싱이 깨지지 않도록 passthrough */
export const healthResponseSchema = z
  .object({
    ok: z.literal(true),
    service: z.string(),
    platformApiVersion: z.string(),
    uptimeSeconds: z.number().int().nonnegative().optional(),
    nodeVersion: z.string().optional(),
    now: z.string()
  })
  .passthrough();

export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** GET /api/ready 본문 — 성공(200) 또는 디스크 실패(503) */
export const readyResponseSchema = z
  .union([
    z
      .object({
        ok: z.literal(true),
        ready: z.literal(true),
        platformApiVersion: z.string(),
        strictAuth: z.boolean(),
        uptimeSeconds: z.number().int().nonnegative(),
        nodeVersion: z.string(),
        now: z.string()
      })
      .passthrough(),
    z
      .object({
        ok: z.literal(false),
        ready: z.literal(false),
        platformApiVersion: z.string(),
        strictAuth: z.boolean(),
        uptimeSeconds: z.number().int().nonnegative(),
        nodeVersion: z.string(),
        now: z.string()
      })
      .passthrough()
  ]);

export type ReadyResponse = z.infer<typeof readyResponseSchema>;
