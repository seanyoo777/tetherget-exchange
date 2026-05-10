import { describe, expect, it } from "vitest";
import { parseBitgetMixTickersResponse } from "./bitgetTickers";

describe("parseBitgetMixTickersResponse", () => {
  it("maps symbols and scales change24h to percent", () => {
    const map = parseBitgetMixTickersResponse({
      code: "00000",
      data: [
        {
          symbol: "BTCUSDT",
          lastPr: "90000.5",
          change24h: "0.01",
          markPrice: "90001",
          fundingRate: "0.0001",
          baseVolume: "1234.5"
        }
      ]
    });
    expect(map.get("BTCUSDT")).toEqual({
      lastPr: 90000.5,
      change24hPct: 1,
      markPrice: 90001,
      fundingRatePct: 0.01,
      baseVolume: 1234.5
    });
  });

  it("throws when code is not success", () => {
    expect(() =>
      parseBitgetMixTickersResponse({ code: "99999", msg: "bad", data: [] })
    ).toThrow(/bad/);
  });

  it("throws when data missing", () => {
    expect(() => parseBitgetMixTickersResponse({ code: "00000" })).toThrow(/rejected/);
  });

  it("skips rows without finite lastPr", () => {
    const map = parseBitgetMixTickersResponse({
      code: "00000",
      data: [{ symbol: "BAD", lastPr: "nan" }, { symbol: "ETHUSDT", lastPr: "3000" }]
    });
    expect(map.has("BAD")).toBe(false);
    expect(map.get("ETHUSDT")?.lastPr).toBe(3000);
  });
});
