import { describe, expect, it } from "vitest";
import { mergePersistMarketPrefs, readMarketPrefsFromStorage, resolveMarketPrefs } from "./marketPrefs";

const valid = (g: string) => ["CRYPTO", "US_STOCKS"].includes(g);
const symbolsFor = (mg: string) => (mg === "US_STOCKS" ? (["AAPL", "TSLA"] as const) : (["BTCUSDT", "ETHUSDT"] as const));

describe("resolveMarketPrefs", () => {
  it("uses saved group and symbol when valid", () => {
    expect(
      resolveMarketPrefs(
        { marketGroup: "US_STOCKS", symbols: { US_STOCKS: "TSLA" } },
        { marketGroup: "CRYPTO", symbol: "BTCUSDT" },
        valid,
        symbolsFor
      )
    ).toEqual({ marketGroup: "US_STOCKS", symbol: "TSLA" });
  });

  it("falls back when symbol not in list", () => {
    expect(
      resolveMarketPrefs(
        { marketGroup: "CRYPTO", symbols: { CRYPTO: "UNKNOWN" } },
        { marketGroup: "CRYPTO", symbol: "BTCUSDT" },
        valid,
        symbolsFor
      ).symbol
    ).toBe("BTCUSDT");
  });

  it("falls back group when invalid", () => {
    expect(
      resolveMarketPrefs(
        { marketGroup: "BAD" },
        { marketGroup: "CRYPTO", symbol: "BTCUSDT" },
        valid,
        symbolsFor
      ).marketGroup
    ).toBe("CRYPTO");
  });
});

describe("readMarketPrefsFromStorage", () => {
  it("reads from getItem", () => {
    const mem = new Map<string, string>([
      ["tgx.market.prefs", JSON.stringify({ marketGroup: "CRYPTO", symbols: { CRYPTO: "ETHUSDT" } })]
    ]);
    const r = readMarketPrefsFromStorage(
      (k) => mem.get(k) ?? null,
      { marketGroup: "CRYPTO", symbol: "BTCUSDT" },
      valid,
      symbolsFor
    );
    expect(r.symbol).toBe("ETHUSDT");
  });
});

describe("mergePersistMarketPrefs", () => {
  it("merges symbols and sets marketGroup", () => {
    const prev = JSON.stringify({
      marketGroup: "CRYPTO",
      symbols: { CRYPTO: "BTCUSDT", US_STOCKS: "AAPL" }
    });
    const next = mergePersistMarketPrefs(prev, "CRYPTO", "ETHUSDT");
    const p = JSON.parse(next) as { marketGroup: string; symbols: Record<string, string> };
    expect(p.marketGroup).toBe("CRYPTO");
    expect(p.symbols.CRYPTO).toBe("ETHUSDT");
    expect(p.symbols.US_STOCKS).toBe("AAPL");
  });
});
