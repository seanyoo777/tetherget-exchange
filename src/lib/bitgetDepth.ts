export type BitgetOrderBookRow = {
  ask: number;
  askQty: number;
  bid: number;
  bidQty: number;
};

/** JSON 페이로드만 검증·변환 (테스트용). `levels`는 최대 호가 단계 수. */
export function parseBitgetMixOrderBookResponse(json: unknown, levels: number): BitgetOrderBookRow[] {
  const payload = json as {
    code?: string;
    msg?: string;
    data?: { asks?: string[][]; bids?: string[][] };
  };
  if (payload.code !== "00000" || !payload.data) {
    throw new Error(payload.msg ?? "bitget mix orderbook rejected");
  }
  const asks = payload.data.asks ?? [];
  const bids = payload.data.bids ?? [];
  const lv = Math.max(levels, 1);
  const n = Math.min(lv, asks.length, bids.length);
  const rows: BitgetOrderBookRow[] = [];
  for (let i = 0; i < n; i++) {
    const ask = Number(asks[i]?.[0]);
    const askQty = Number(asks[i]?.[1]);
    const bid = Number(bids[i]?.[0]);
    const bidQty = Number(bids[i]?.[1]);
    if (![ask, askQty, bid, bidQty].every(Number.isFinite)) continue;
    rows.push({ ask, askQty, bid, bidQty });
  }
  if (rows.length === 0) throw new Error("bitget mix orderbook empty");
  return rows;
}

/** Bitget V2 USDT-M perpetual (mix) depth snapshot — matches `productType=USDT-FUTURES` tickers. */
export async function fetchBitgetMixUsdtOrderBook(symbol: string, levels: number): Promise<BitgetOrderBookRow[]> {
  const limit = Math.min(200, Math.max(levels, 1));
  const url =
    `https://api.bitget.com/api/v2/mix/market/orderbook` +
    `?symbol=${encodeURIComponent(symbol)}&productType=USDT-FUTURES&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`bitget mix orderbook http ${res.status}`);
  const json = await res.json();
  return parseBitgetMixOrderBookResponse(json, levels);
}
