import { describe, expect, it } from "vite-plus/test";
import { looksLikeMarkdown } from "./looks-like-markdown";

describe("looksLikeMarkdown", () => {
  it.each([
    "## Plan\nsome text",
    "- one\n- two",
    "1. first\n2. second",
    "- [ ] todo\n- [x] done",
    "> quoted",
    "```ts\nconst a = 1\n```",
    "a **bold** word",
    "an _emphasised_ word",
    "~~gone~~",
    "run `pnpm test` first",
    "see [docs](https://example.com)",
    "above\n\n---\n\nbelow",
  ])("recognises %j", (text) => {
    expect(looksLikeMarkdown(text)).toBe(true);
  });

  it.each([
    "Just a plain sentence.",
    "Two lines\nof prose, with a comma.",
    "snake_case_name and 3 * 4 = 12",
    "email me at a@b.com (soon)",
    "#hashtag without a space",
    "",
  ])("leaves %j as text", (text) => {
    expect(looksLikeMarkdown(text)).toBe(false);
  });
});
