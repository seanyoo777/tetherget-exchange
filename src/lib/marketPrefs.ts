/**
 * 시장군·심볼 UI 상태 localStorage (`tgx.market.prefs`)
 */

export const MARKET_PREFS_KEY = "tgx.market.prefs";

export type MarketPrefsStored = {
  marketGroup?: string;
  symbols?: Record<string, string>;
};

export function resolveMarketPrefs(
  parsed: MarketPrefsStored | null | undefined,
  fallback: { marketGroup: string; symbol: string },
  isValidGroup: (g: string) => boolean,
  symbolsFor: (mg: string) => readonly string[]
): { marketGroup: string; symbol: string } {
  if (!parsed) return fallback;
  const mg = parsed.marketGroup && isValidGroup(parsed.marketGroup) ? parsed.marketGroup : fallback.marketGroup;
  const list = symbolsFor(mg);
  const saved = parsed.symbols?.[mg];
  const sym = saved && list.includes(saved) ? saved : list[0];
  return { marketGroup: mg, symbol: sym };
}

export function readMarketPrefsFromStorage(
  getItem: (key: string) => string | null,
  fallback: { marketGroup: string; symbol: string },
  isValidGroup: (g: string) => boolean,
  symbolsFor: (mg: string) => readonly string[]
): { marketGroup: string; symbol: string } {
  try {
    const raw = getItem(MARKET_PREFS_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as MarketPrefsStored;
    return resolveMarketPrefs(p, fallback, isValidGroup, symbolsFor);
  } catch {
    return fallback;
  }
}

export function mergePersistMarketPrefs(
  prevRaw: string | null,
  marketGroup: string,
  symbol: string
): string {
  let symbols: Record<string, string> = {};
  try {
    if (prevRaw) {
      const prev = JSON.parse(prevRaw) as MarketPrefsStored;
      if (prev.symbols) symbols = { ...prev.symbols };
    }
  } catch {
    /* ignore corrupt */
  }
  symbols[marketGroup] = symbol;
  return JSON.stringify({ marketGroup, symbols });
}
