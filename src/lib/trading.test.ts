import { describe, expect, it } from "vitest";
import {
  calcLiquidationPrice,
  calcUnrealizedPnl,
  formatTickSizeDisplay,
  priceDecimalsForTick,
  validateOrder
} from "./trading";

describe("validateOrder", () => {
  const ok = { qty: 1, price: 50000, leverage: 10, balanceUsdt: 10000 };

  it("accepts valid margin", () => {
    expect(validateOrder(ok)).toBeNull();
  });

  it("rejects non-positive qty", () => {
    expect(validateOrder({ ...ok, qty: 0 })).toMatch(/수량/);
    expect(validateOrder({ ...ok, qty: NaN })).toMatch(/수량/);
  });

  it("rejects invalid price", () => {
    expect(validateOrder({ ...ok, price: 0 })).toMatch(/가격/);
  });

  it("rejects leverage out of range", () => {
    expect(validateOrder({ ...ok, leverage: 0 })).toMatch(/레버리지/);
    expect(validateOrder({ ...ok, leverage: 101 })).toMatch(/레버리지/);
  });

  it("rejects insufficient balance", () => {
    expect(validateOrder({ ...ok, balanceUsdt: 1 })).toMatch(/잔고/);
  });
});

describe("calcLiquidationPrice", () => {
  it("long: entry minus maintenance band", () => {
    expect(calcLiquidationPrice(100, 10, "LONG")).toBeCloseTo(91);
  });

  it("short: entry plus maintenance band", () => {
    expect(calcLiquidationPrice(100, 10, "SHORT")).toBeCloseTo(109);
  });
});

describe("calcUnrealizedPnl", () => {
  it("long profits when mark rises", () => {
    expect(calcUnrealizedPnl(100, 110, 1, "LONG")).toBeCloseTo(10);
  });

  it("short profits when mark falls", () => {
    expect(calcUnrealizedPnl(100, 90, 2, "SHORT")).toBeCloseTo(20);
  });
});

describe("priceDecimalsForTick", () => {
  it("uses -log10 for power-of-10 ticks", () => {
    expect(priceDecimalsForTick(0.1)).toBe(1);
    expect(priceDecimalsForTick(0.01)).toBe(2);
    expect(priceDecimalsForTick(0.0001)).toBe(4);
    expect(priceDecimalsForTick(0.00001)).toBe(5);
  });

  it("returns 0 for tick >= 1", () => {
    expect(priceDecimalsForTick(1)).toBe(0);
    expect(priceDecimalsForTick(10)).toBe(0);
  });
});

describe("formatTickSizeDisplay", () => {
  it("formats small power-of-10 ticks without scientific notation", () => {
    expect(formatTickSizeDisplay(0.00001)).toBe("0.00001");
    expect(formatTickSizeDisplay(0.0001)).toBe("0.0001");
  });

  it("returns em dash for invalid", () => {
    expect(formatTickSizeDisplay(NaN)).toBe("—");
    expect(formatTickSizeDisplay(-1)).toBe("—");
  });
});
