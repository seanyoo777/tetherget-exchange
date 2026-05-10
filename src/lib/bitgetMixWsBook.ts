import type { BitgetOrderBookRow } from "./bitgetDepth";

const WS_PUBLIC = "wss://ws.bitget.com/v2/ws/public";

/** Pair top-N ask levels with top-N bid levels for the ladder UI (row i = ask_i + bid_i). */
export function mixDepthLevelsToRows(asks: string[][], bids: string[][], rowCount: number): BitgetOrderBookRow[] {
  const n = Math.min(rowCount, asks.length, bids.length);
  const rows: BitgetOrderBookRow[] = [];
  for (let i = 0; i < n; i++) {
    const ask = Number(asks[i]?.[0]);
    const askQty = Number(asks[i]?.[1]);
    const bid = Number(bids[i]?.[0]);
    const bidQty = Number(bids[i]?.[1]);
    if (![ask, askQty, bid, bidQty].every(Number.isFinite)) continue;
    rows.push({ ask, askQty, bid, bidQty });
  }
  return rows;
}

export type MixBooksCallbacks = {
  onRows: (rows: BitgetOrderBookRow[]) => void;
  /** Called when the socket errors or closes (before optional reconnect). */
  onSocketInactive?: () => void;
};

/**
 * Bitget public WS — USDT-M perpetual depth (`books15` = full snapshot each push, ~150ms).
 * Sends raw text `"ping"` every 30s per Bitget docs.
 */
export function subscribeBitgetMixBooks15(params: {
  symbol: string;
  ladderRows: number;
  callbacks: MixBooksCallbacks;
  reconnectMs?: number;
}): () => void {
  const { symbol, ladderRows, callbacks, reconnectMs = 5000 } = params;
  let ws: WebSocket | null = null;
  let pingId: number | undefined;
  let reconnectId: number | undefined;
  let stopped = false;

  const clearTimers = () => {
    if (pingId != null) {
      window.clearInterval(pingId);
      pingId = undefined;
    }
    if (reconnectId != null) {
      window.clearTimeout(reconnectId);
      reconnectId = undefined;
    }
  };

  const connect = () => {
    if (stopped) return;
    ws = new WebSocket(WS_PUBLIC);
    ws.onopen = () => {
      ws?.send(
        JSON.stringify({
          op: "subscribe",
          args: [{ instType: "USDT-FUTURES", channel: "books15", instId: symbol }]
        })
      );
      pingId = window.setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) ws.send("ping");
      }, 30000);
    };

    ws.onmessage = (ev) => {
      const raw = String(ev.data);
      if (raw === "pong") return;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return;
      }
      if (msg.event === "subscribe") return;
      if (msg.event === "error") return;
      const action = msg.action;
      if (action !== "snapshot" && action !== "update") return;
      const data = msg.data as undefined | Array<{ asks?: string[][]; bids?: string[][] }>;
      const chunk = data?.[0];
      if (!chunk?.asks?.length || !chunk?.bids?.length) return;
      const rows = mixDepthLevelsToRows(chunk.asks, chunk.bids, ladderRows);
      if (rows.length > 0) callbacks.onRows(rows);
    };

    ws.onerror = () => {
      callbacks.onSocketInactive?.();
    };

    ws.onclose = () => {
      clearTimers();
      callbacks.onSocketInactive?.();
      if (!stopped) {
        reconnectId = window.setTimeout(() => connect(), reconnectMs);
      }
    };
  };

  connect();

  return () => {
    stopped = true;
    clearTimers();
    ws?.close();
    ws = null;
  };
}
