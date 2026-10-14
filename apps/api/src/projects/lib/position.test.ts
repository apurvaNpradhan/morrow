import { generateKeyBetween } from "fractional-indexing";
import { describe, expect, it } from "vite-plus/test";
import { assertValidPosition } from "./position";

describe("assertValidPosition", () => {
  it("accepts keys the library generated", () => {
    const first = generateKeyBetween(null, null);
    const between = generateKeyBetween(first, generateKeyBetween(first, null));
    for (const key of [first, between, generateKeyBetween(null, first)]) {
      expect(() => assertValidPosition(key)).not.toThrow();
    }
  });

  it.each(["", "a00", "A", "zzz", "a0 ", "é"])("rejects %j", (key) => {
    expect(() => assertValidPosition(key)).toThrowError(
      expect.objectContaining({ data: { code: "INVALID_POSITION" } }),
    );
  });
});
