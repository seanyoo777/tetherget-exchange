export type BitgetOrderBookRow = {
  ask: number;
  askQty: number;
  bid: number;
  bidQty: number;
};

/** Bitget V2 USDT-M perpetual (mix) depth snapshot — matches `productType=USDT-FUTURES` tickers. */
export async function fetchBitgetMixUsdtOrderBook(symbol: string, levels: number): Promise<BitgetOrderBookRow[]> {
  const limit = Math.min(200, Math.max(levels, 1));
  const url =
    `https://api.bitget.com/api/v2/mix/market/orderbook` +
    `?symbol=${encodeURIComponent(symbol)}&productType=USDT-FUTURES&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`bitget mix orderbook http ${res.status}`);
  const json = (await res.json()) as {
    code?: string;
    msg?: string;
    data?: { asks?: string[][]; bids?: string[][] };
  };
  if (json.code !== "00000" || !json.data) {
    throw new Error(json.msg ?? "bitget mix orderbook rejected");
  }
  const asks = json.data.asks ?? [];
  const bids = json.data.bids ?? [];
  const n = Math.min(levels, asks.length, bids.length);
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
