import { describe, expect, it, vi } from "vitest";
import {
  MARKET_PREFS_KEY,
  mergePersistMarketPrefs,
  mergePersistedMarketJson,
  readMarketPrefsFromStorage,
  resolvePersistedMarketSelection,
  type MarketGroupKey
} from "./marketPrefs";

const LISTS: Record<MarketGroupKey, readonly string[]> = {
  CRYPTO: ["BTCUSDT", "ETHUSDT"],
  US_STOCKS: ["AAPL"],
  KR_STOCKS: ["005930.KS"],
  US_FUTURES: ["NQ=F"],
  KR_FUTURES: ["KOSPI200F"]
};

describe("resolvePersistedMarketSelection", () => {
  it("uses defaults when payload null", () => {
    expect(resolvePersistedMarketSelection(null, LISTS)).toEqual({
      marketGroup: "CRYPTO",
      symbol: "BTCUSDT"
    });
  });

  it("restores saved symbol when valid", () => {
    expect(
      resolvePersistedMarketSelection(
        { marketGroup: "CRYPTO", symbols: { CRYPTO: "ETHUSDT" } },
        LISTS
      )
    ).toEqual({ marketGroup: "CRYPTO", symbol: "ETHUSDT" });
  });

  it("falls back to first list symbol when saved invalid", () => {
    expect(
      resolvePersistedMarketSelection(
        { marketGroup: "CRYPTO", symbols: { CRYPTO: "UNKNOWN" } },
        LISTS
      )
    ).toEqual({ marketGroup: "CRYPTO", symbol: "BTCUSDT" });
  });
});

describe("mergePersistedMarketJson / mergePersistMarketPrefs", () => {
  it("merges symbols and sets marketGroup", () => {
    const prev = JSON.stringify({
      marketGroup: "CRYPTO",
      symbols: { CRYPTO: "BTCUSDT" }
    });
    expect(mergePersistedMarketJson(prev, "US_STOCKS", "AAPL")).toEqual(
      mergePersistMarketPrefs(prev, "US_STOCKS", "AAPL")
    );
    expect(JSON.parse(mergePersistMarketPrefs(prev, "US_STOCKS", "AAPL"))).toEqual({
      marketGroup: "US_STOCKS",
      symbols: { CRYPTO: "BTCUSDT", US_STOCKS: "AAPL" }
    });
  });
});

describe("readMarketPrefsFromStorage", () => {
  const isMg = (g: string): g is MarketGroupKey => g in LISTS;

  it("reads from injected storage", () => {
    const getItem = vi.fn((key: string) =>
      key === MARKET_PREFS_KEY
        ? JSON.stringify({ marketGroup: "CRYPTO", symbols: { CRYPTO: "ETHUSDT" } })
        : null
    );
    const r = readMarketPrefsFromStorage(
      getItem,
      { marketGroup: "CRYPTO", symbol: "BTCUSDT" },
      isMg,
      (mg) => LISTS[mg]
    );
    expect(r).toEqual({ marketGroup: "CRYPTO", symbol: "ETHUSDT" });
  });

  it("returns fallback when empty", () => {
    const getItem = vi.fn(() => null);
    const fb = { marketGroup: "CRYPTO" as const, symbol: "BTCUSDT" };
    expect(
      readMarketPrefsFromStorage(getItem, fb, isMg, (mg) => LISTS[mg])
    ).toEqual(fb);
  });
});
