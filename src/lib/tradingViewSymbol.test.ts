import { describe, expect, it } from "vitest";
import { tradingViewSymbol } from "./tradingViewSymbol";

describe("tradingViewSymbol", () => {
  it("CRYPTO: USDT pairs → BINANCE", () => {
    expect(tradingViewSymbol("CRYPTO", "BTCUSDT")).toBe("BINANCE:BTCUSDT");
    expect(tradingViewSymbol("CRYPTO", "ethusdt")).toBe("BINANCE:ETHUSDT");
  });

  it("CRYPTO: non-USDT suffix → null", () => {
    expect(tradingViewSymbol("CRYPTO", "BTC-PERP")).toBeNull();
  });

  it("US_STOCKS: strips suffix for NASDAQ", () => {
    expect(tradingViewSymbol("US_STOCKS", "AAPL")).toBe("NASDAQ:AAPL");
  });

  it("KR_STOCKS: 6-digit code → KRX", () => {
    expect(tradingViewSymbol("KR_STOCKS", "005930.KS")).toBe("KRX:005930");
  });

  it("KR_STOCKS: invalid code → null", () => {
    expect(tradingViewSymbol("KR_STOCKS", "BAD")).toBeNull();
  });

  it("US_FUTURES: major roots", () => {
    expect(tradingViewSymbol("US_FUTURES", "NQ=F")).toBe("CME_MINI:NQ1!");
    expect(tradingViewSymbol("US_FUTURES", "ES=F")).toBe("CME_MINI:ES1!");
    expect(tradingViewSymbol("US_FUTURES", "GC=F")).toBe("COMEX:GC1!");
    expect(tradingViewSymbol("US_FUTURES", "CL=F")).toBe("NYMEX:CL1!");
  });

  it("KR_FUTURES → null", () => {
    expect(tradingViewSymbol("KR_FUTURES", "KOSPI200F")).toBeNull();
  });
});
