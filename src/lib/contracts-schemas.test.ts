import { describe, expect, it } from "vitest";
import { healthResponseSchema, readyResponseSchema } from "@tetherget/contracts/schemas";

describe("healthResponseSchema", () => {
  it("parses backend-shaped payload and preserves passthrough keys", () => {
    const raw = {
      ok: true,
      service: "tetherget-backend",
      platformApiVersion: "0.1.0",
      uptimeSeconds: 10,
      nodeVersion: "v20.1.0",
      now: "2026-05-10T12:00:00.000Z",
      futureKey: "ok"
    };
    const r = healthResponseSchema.safeParse(raw);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.futureKey).toBe("ok");
  });
});

describe("readyResponseSchema", () => {
  it("accepts ready true (200)", () => {
    const r = readyResponseSchema.safeParse({
      ok: true,
      ready: true,
      platformApiVersion: "0.1.0",
      strictAuth: false,
      uptimeSeconds: 3,
      nodeVersion: "v20.0.0",
      now: "2026-05-10T12:00:00.000Z"
    });
    expect(r.success).toBe(true);
  });

  it("accepts ready false (503)", () => {
    const r = readyResponseSchema.safeParse({
      ok: false,
      ready: false,
      platformApiVersion: "0.1.0",
      strictAuth: true,
      uptimeSeconds: 1,
      nodeVersion: "v20.0.0",
      now: "2026-05-10T12:00:00.000Z"
    });
    expect(r.success).toBe(true);
  });
});
