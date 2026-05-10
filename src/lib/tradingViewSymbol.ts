/** Maps app market + 심볼 → TradingView `exchange:symbol` (위젯용). 미지원이면 null. */

export type TvMarketGroupKey = "CRYPTO" | "US_STOCKS" | "KR_STOCKS" | "US_FUTURES" | "KR_FUTURES";

export function tradingViewSymbol(marketGroup: TvMarketGroupKey, symbol: string): string | null {
  const u = symbol.trim().toUpperCase();
  switch (marketGroup) {
    case "CRYPTO":
      if (/USDT$/i.test(symbol)) return `BINANCE:${u}`;
      return null;
    case "US_STOCKS": {
      const base = symbol.replace(/\..*$/, "").toUpperCase();
      return base ? `NASDAQ:${base}` : null;
    }
    case "KR_STOCKS": {
      const code = symbol.replace(/\.KS$/i, "").replace(/\..*$/, "");
      return /^\d{6}$/.test(code) ? `KRX:${code}` : null;
    }
    case "US_FUTURES":
      if (u.startsWith("NQ")) return "CME_MINI:NQ1!";
      if (u.startsWith("ES")) return "CME_MINI:ES1!";
      if (u.startsWith("GC")) return "COMEX:GC1!";
      if (u.startsWith("CL")) return "NYMEX:CL1!";
      return null;
    case "KR_FUTURES":
      return null;
    default:
      return null;
  }
}
