/**
 * Bitget mix USDT-M 전종목 티커 — 레일·24h% 일괄 반영용.
 * GET /api/v2/mix/market/tickers?productType=USDT-FUTURES
 */

export type BitgetMixTickerBrief = {
  lastPr: number;
  /** UI 표시용 % (단일 티커와 동일: API ratio × 100) */
  change24hPct: number;
  markPrice: number | null;
  /** 펀딩 비율을 UI %로 (API ratio × 100) */
  fundingRatePct: number | null;
  baseVolume: number | null;
};

export async function fetchBitgetMixUsdtAllTickers(): Promise<Map<string, BitgetMixTickerBrief>> {
  const url = "https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`bitget tickers http ${res.status}`);
  const json = (await res.json()) as {
    code?: string;
    msg?: string;
    data?: Array<{
      symbol?: string;
      lastPr?: string;
      change24h?: string;
      markPrice?: string;
      fundingRate?: string;
      baseVolume?: string;
    }>;
  };
  if (json.code !== "00000" || !json.data) {
    throw new Error(json.msg ?? "bitget tickers rejected");
  }
  const out = new Map<string, BitgetMixTickerBrief>();
  for (const row of json.data) {
    const sym = row.symbol?.trim().toUpperCase();
    if (!sym) continue;
    const lastPr = Number(row.lastPr);
    const change24hPct = Number(row.change24h ?? 0) * 100;
    const mp = row.markPrice != null ? Number(row.markPrice) : NaN;
    const fr = row.fundingRate != null ? Number(row.fundingRate) * 100 : NaN;
    const bv = row.baseVolume != null ? Number(row.baseVolume) : NaN;
    if (!Number.isFinite(lastPr)) continue;
    out.set(sym, {
      lastPr,
      change24hPct: Number.isFinite(change24hPct) ? change24hPct : 0,
      markPrice: Number.isFinite(mp) ? mp : null,
      fundingRatePct: Number.isFinite(fr) ? fr : null,
      baseVolume: Number.isFinite(bv) ? bv : null
    });
  }
  return out;
}
