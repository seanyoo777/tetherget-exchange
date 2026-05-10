import { describe, expect, it } from "vitest";
import { maskSessionTokenPreview } from "./maskSessionToken";

describe("maskSessionTokenPreview", () => {
  it("masks short tokens entirely", () => {
    expect(maskSessionTokenPreview("")).toBe("••••••••");
    expect(maskSessionTokenPreview("short")).toBe("••••••••");
    expect(maskSessionTokenPreview("12345678")).toBe("••••••••");
  });

  it("shows last 4 chars for longer tokens", () => {
    expect(maskSessionTokenPreview("123456789")).toBe("••••••••…6789");
    expect(maskSessionTokenPreview("aaaaaaaaaaaaaaaa")).toBe("••••••••…aaaa");
  });

  it("trims whitespace", () => {
    expect(maskSessionTokenPreview("  abcdefghij  ")).toBe("••••••••…ghij");
  });
});
