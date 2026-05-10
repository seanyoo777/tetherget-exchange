export type ValidateOrderInput = {
  qty: number;
  leverage: number;
  price: number;
  balanceUsdt: number;
};

export function validateOrder(input: ValidateOrderInput): string | null {
  if (!Number.isFinite(input.qty) || input.qty <= 0) {
    return "주문 수량은 0보다 커야 합니다.";
  }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    return "가격 정보가 유효하지 않습니다.";
  }
  if (!Number.isFinite(input.leverage) || input.leverage < 1 || input.leverage > 100) {
    return "레버리지는 1~100 범위여야 합니다.";
  }
  const margin = (input.price * input.qty) / input.leverage;
  if (margin > input.balanceUsdt) {
    return "잔고가 부족합니다.";
  }
  return null;
}

export function calcLiquidationPrice(
  entryPrice: number,
  leverage: number,
  side: "LONG" | "SHORT"
): number {
  if (side === "LONG") {
    return entryPrice * (1 - 0.9 / leverage);
  }
  return entryPrice * (1 + 0.9 / leverage);
}

export function calcUnrealizedPnl(
  entryPrice: number,
  markPrice: number,
  qty: number,
  side: "LONG" | "SHORT"
): number {
  const diff = side === "LONG" ? markPrice - entryPrice : entryPrice - markPrice;
  return diff * qty;
}

/** 호가 틱에서 toFixed 자릿수 (10^n 틱 및 일반 소수 틱 공통). */
export function priceDecimalsForTick(tickSize: number): number {
  if (tickSize >= 1) return 0;
  const lg = -Math.log10(tickSize);
  if (Number.isFinite(lg) && Math.abs(lg - Math.round(lg)) < 1e-9) {
    return Math.min(16, Math.max(0, Math.round(lg)));
  }
  return String(tickSize).split(".")[1]?.length ?? 2;
}

/** 레일·툴팁용 — 과학적 표기 없이 고정 소수 문자열. */
export function formatTickSizeDisplay(tickSize: number): string {
  if (!Number.isFinite(tickSize) || tickSize <= 0) return "—";
  if (tickSize >= 1 && Number.isInteger(tickSize)) return String(tickSize);
  const d = priceDecimalsForTick(tickSize);
  return tickSize.toFixed(Math.min(16, d));
}
