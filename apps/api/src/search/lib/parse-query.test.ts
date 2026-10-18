import { describe, expect, it } from "vite-plus/test";
import { parseQuery } from "./parse-query";

describe("parseQuery", () => {
  it("turns each word into a prefix term", () => {
    expect(parseQuery("login bug")).toEqual({
      words: ["login", "bug"],
      tsquery: "login:* & bug:*",
      text: "login bug",
    });
  });

  it("lowercases and ignores extra whitespace", () => {
    expect(parseQuery("  Fix   AUTH ")?.tsquery).toBe("fix:* & auth:*");
  });

  it("keeps letters and digits of any script", () => {
    expect(parseQuery("café 2fa")?.words).toEqual(["café", "2fa"]);
  });

  it.each(["%", "_", "'", '"', "&", "|", "!", ":", "*", "(", ")", "\\", "<->"])(
    "cannot be bent by %s",
    (symbol) => {
      expect(parseQuery(`a${symbol}b`)?.tsquery).toBe("a:* & b:*");
      expect(parseQuery(symbol)).toBeNull();
    },
  );

  it("returns nothing for empty or symbol-only input", () => {
    expect(parseQuery("")).toBeNull();
    expect(parseQuery("   ")).toBeNull();
    expect(parseQuery("?!-")).toBeNull();
  });

  it("bounds the number and length of words", () => {
    const many = parseQuery("a b c d e f g h i j k l")!;
    expect(many.words).toHaveLength(8);
    expect(parseQuery("x".repeat(500))!.words[0]).toHaveLength(64);
  });
});
