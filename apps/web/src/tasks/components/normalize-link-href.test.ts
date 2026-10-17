import { describe, expect, it } from "vite-plus/test";
import { normalizeLinkHref } from "./normalize-link-href";

describe("normalizeLinkHref", () => {
  it.each([
    ["https://example.com", "https://example.com"],
    ["http://example.com/a?b=1#c", "http://example.com/a?b=1#c"],
    ["example.com", "https://example.com"],
    ["www.example.com/docs", "https://www.example.com/docs"],
    ["example.com:8080/x", "https://example.com:8080/x"],
    ["localhost:3000", "https://localhost:3000"],
    ["a@b.co", "mailto:a@b.co"],
    ["mailto:a@b.co", "mailto:a@b.co"],
    ["  example.com  ", "https://example.com"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeLinkHref(input)).toBe(expected);
  });

  it.each([
    "",
    "   ",
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,hi",
    "ftp://example.com",
    "vbscript:x",
    "two words.com",
    "nodots",
    "http://",
  ])("rejects %j", (input) => {
    expect(normalizeLinkHref(input)).toBeNull();
  });
});
