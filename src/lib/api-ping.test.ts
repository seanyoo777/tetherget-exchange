import { afterEach, describe, expect, it, vi } from "vitest";
import { pingHealth, pingReady } from "./api";

const healthOkJson = () =>
  JSON.stringify({
    ok: true,
    service: "tetherget-backend",
    platformApiVersion: "0.1.0",
    uptimeSeconds: 5,
    nodeVersion: "v22.0.0",
    now: "2026-05-10T12:00:00.000Z"
  });

const readyOkJson = () =>
  JSON.stringify({
    ok: true,
    ready: true,
    platformApiVersion: "0.1.0",
    strictAuth: false,
    uptimeSeconds: 2,
    nodeVersion: "v20.0.0",
    now: "2026-05-10T12:00:00.000Z"
  });

const readyFailJson = () =>
  JSON.stringify({
    ok: false,
    ready: false,
    platformApiVersion: "0.1.0",
    strictAuth: true,
    uptimeSeconds: 1,
    nodeVersion: "v20.0.0",
    now: "2026-05-10T12:00:00.000Z"
  });

describe("pingHealth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses 200 and returns body fields", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => healthOkJson()
    } as Response);

    const r = await pingHealth();
    expect(r.body.platformApiVersion).toBe("0.1.0");
    expect(r.body.service).toBe("tetherget-backend");
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("throws when status is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => healthOkJson()
    } as Response);

    await expect(pingHealth()).rejects.toThrow();
  });

  it("throws when body is not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "not-json"
    } as Response);

    await expect(pingHealth()).rejects.toThrow();
  });
});

describe("pingReady", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses 200 and returns ready true", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => readyOkJson()
    } as Response);

    const r = await pingReady();
    expect(r.body.ready).toBe(true);
    expect(r.body.ok).toBe(true);
  });

  it("parses 503 and returns ready false", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => readyFailJson()
    } as Response);

    const r = await pingReady();
    expect(r.body.ready).toBe(false);
    expect(r.body.ok).toBe(false);
  });

  it("throws on non-503 error status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '{"err":true}'
    } as Response);

    await expect(pingReady()).rejects.toThrow();
  });

  it("throws when response body is not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "not-json"
    } as Response);

    await expect(pingReady()).rejects.toThrow();
  });
});
