import { describe, expect, it } from "vitest";
import { defaultApiProbeIntervalMs } from "./apiProbeInterval";

describe("defaultApiProbeIntervalMs", () => {
  it("returns a sane default (built-time env usually unset in tests)", () => {
    const ms = defaultApiProbeIntervalMs();
    expect(ms).toBeGreaterThanOrEqual(5000);
    expect(ms).toBeLessThanOrEqual(3_600_000);
  });
});
