import { describe, expect, it } from "vitest";
import { parseBitgetMixOrderBookResponse } from "./bitgetDepth";

describe("parseBitgetMixOrderBookResponse", () => {
  const payload = {
    code: "00000",
    data: {
      asks: [
        ["101", "1.5"],
        ["102", "2"]
      ],
      bids: [
        ["100", "3"],
        ["99", "4"]
      ]
    }
  };

  it("zips asks/bids up to levels", () => {
    const rows = parseBitgetMixOrderBookResponse(payload, 8);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ ask: 101, askQty: 1.5, bid: 100, bidQty: 3 });
    expect(rows[1]).toEqual({ ask: 102, askQty: 2, bid: 99, bidQty: 4 });
  });

  it("respects levels cap", () => {
    const one = parseBitgetMixOrderBookResponse(payload, 1);
    expect(one).toHaveLength(1);
  });

  it("throws on bad code", () => {
    expect(() => parseBitgetMixOrderBookResponse({ code: "x", data: { asks: [], bids: [] } }, 8)).toThrow(
      /rejected/
    );
  });

  it("throws when no valid rows", () => {
    expect(() =>
      parseBitgetMixOrderBookResponse(
        {
          code: "00000",
          data: { asks: [["nan", "1"]], bids: [["1", "1"]] }
        },
        8
      )
    ).toThrow(/empty/);
  });
});
