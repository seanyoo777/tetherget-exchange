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
