/**
 * Yahoo Finance chart 엔드포인트로 일중 변동률 근사 (메인 티커·카드용).
 * 앱 내 기존 시세 폴링과 동일 엔드포인트.
 */
export async function fetchYahooDayChangePct(
  symbol: string
): Promise<{ price: number; changePct: number } | null> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; chartPreviousClose?: number } }> };
  };
  const meta = data.chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice ?? NaN);
  const prevClose = Number(meta?.chartPreviousClose ?? price);
  if (!Number.isFinite(price)) return null;
  const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
  return { price, changePct };
}
