import { describe, expect, it } from "vitest";
import { formatHealthProbeTooltip } from "./healthProbeTooltip";

describe("formatHealthProbeTooltip", () => {
  const base = {
    latencyMs: 42,
    serverNow: "2026-05-10T03:00:00.000Z",
    probedAt: new Date("2026-05-10T03:00:01.000Z").getTime()
  };

  it("includes latency and three base lines", () => {
    const s = formatHealthProbeTooltip(base);
    expect(s).toMatch(/응답 지연: 42ms/);
    expect(s.split("\n").length).toBeGreaterThanOrEqual(3);
    expect(s).toContain("서버 시각:");
    expect(s).toContain("마지막 성공 응답:");
  });

  it("appends Node when nodeVersion set", () => {
    const s = formatHealthProbeTooltip({ ...base, nodeVersion: "v22.1.0" });
    expect(s).toContain("Node: v22.1.0");
  });

  it("appends disk ready line when diskReady is boolean", () => {
    expect(formatHealthProbeTooltip({ ...base, diskReady: true })).toContain(
      "레디(디스크 쓰기): OK"
    );
    expect(formatHealthProbeTooltip({ ...base, diskReady: false })).toContain(
      "레디(디스크 쓰기): 실패"
    );
  });

  it("omits disk line when diskReady undefined", () => {
    const s = formatHealthProbeTooltip(base);
    expect(s).not.toContain("레디(디스크");
  });
});
