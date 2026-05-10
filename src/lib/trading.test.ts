import { describe, expect, it } from "vitest";
import { formatTickSizeDisplay, priceDecimalsForTick } from "./trading";

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
