import { describe, expect, it } from "vite-plus/test";
import { matchesQuery } from "./matches-query";

describe("matchesQuery", () => {
  it("needs every word to appear in one of the texts, in any case", () => {
    expect(matchesQuery("web site", ["Website", "WEB"])).toBe(true);
    expect(matchesQuery("web zzz", ["Website", "WEB"])).toBe(false);
  });

  it("matches nothing for a query without words", () => {
    expect(matchesQuery("  ?!", ["Website"])).toBe(false);
  });

  it("finds a word typed across texts", () => {
    expect(
      matchesQuery("ada lovelace", ["Ada Lovelace", "ada@example.com"]),
    ).toBe(true);
    expect(
      matchesQuery("ada example", ["Ada Lovelace", "ada@example.com"]),
    ).toBe(true);
  });
});
