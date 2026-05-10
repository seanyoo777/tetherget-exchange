/** localStorage `tgx.market.prefs` — 시장군·시장군별 마지막 심볼 */

export const MARKET_PREFS_KEY = "tgx.market.prefs";

export type MarketGroupKey = "CRYPTO" | "US_STOCKS" | "KR_STOCKS" | "US_FUTURES" | "KR_FUTURES";

export type PersistedMarketPayload = {
  marketGroup?: string;
  symbols?: Partial<Record<MarketGroupKey, string>>;
};

export function resolvePersistedMarketSelection(
  payload: PersistedMarketPayload | null,
  symbolLists: Record<MarketGroupKey, readonly string[]>,
  defaultGroup: MarketGroupKey = "CRYPTO"
): { marketGroup: MarketGroupKey; symbol: string } {
  if (!payload) {
    return { marketGroup: defaultGroup, symbol: symbolLists[defaultGroup][0] };
  }
  const mg =
    payload.marketGroup && payload.marketGroup in symbolLists
      ? (payload.marketGroup as MarketGroupKey)
      : defaultGroup;
  const list = symbolLists[mg];
  const saved = payload.symbols?.[mg];
  const sym = saved && list.includes(saved) ? saved : list[0];
  return { marketGroup: mg, symbol: sym };
}

/** 기존 저장 문자열과 병합해 다시 직렬화 (symbols 맵 유지). */
export function mergePersistedMarketJson(
  prevJson: string | null,
  marketGroup: MarketGroupKey,
  symbol: string
): string {
  let prev: PersistedMarketPayload = {};
  if (prevJson) {
    try {
      prev = JSON.parse(prevJson) as PersistedMarketPayload;
    } catch {
      prev = {};
    }
  }
  return JSON.stringify({
    marketGroup,
    symbols: { ...prev.symbols, [marketGroup]: symbol }
  });
}

/** App 등에서 쓰는 이름과 호환 */
export const mergePersistMarketPrefs = mergePersistedMarketJson;

/** 테스트·SSR 대비: 저장소 읽기 함수 주입 */
export function readMarketPrefsFromStorage(
  getItem: (key: string) => string | null,
  fallback: { marketGroup: MarketGroupKey; symbol: string },
  isMarketGroup: (g: string) => g is MarketGroupKey,
  getSymbolsForGroup: (mg: MarketGroupKey) => readonly string[]
): { marketGroup: MarketGroupKey; symbol: string } {
  try {
    const raw = getItem(MARKET_PREFS_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as PersistedMarketPayload;
    const mgCandidate = p.marketGroup ?? fallback.marketGroup;
    const mg = isMarketGroup(mgCandidate) ? mgCandidate : fallback.marketGroup;
    const list = getSymbolsForGroup(mg);
    const saved = p.symbols?.[mg];
    const sym = saved && list.includes(saved) ? saved : list[0];
    return { marketGroup: mg, symbol: sym };
  } catch {
    return fallback;
  }
}
