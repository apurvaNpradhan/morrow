import { describe, expect, it } from "vite-plus/test";
import { branchName } from "./branch-name";

describe("branchName", () => {
  it("joins the lowercased ticket id and the slugged title", () => {
    expect(branchName("MOR-12", "External links on a task")).toBe(
      "mor-12-external-links-on-a-task",
    );
  });

  it("collapses punctuation and emoji into single dashes", () => {
    expect(branchName("MOR-1", "  Fix: login -- 🚀 broken!! ")).toBe(
      "mor-1-fix-login-broken",
    );
  });

  it("strips accents", () => {
    expect(branchName("MOR-2", "Café résumé Zoë")).toBe(
      "mor-2-cafe-resume-zoe",
    );
  });

  it("gives just the ticket id for a title with no letters or digits", () => {
    expect(branchName("MOR-3", "!!! 🚀 ???")).toBe("mor-3");
    expect(branchName("MOR-3", "")).toBe("mor-3");
  });

  it("caps at 60 characters, cutting at a word boundary", () => {
    const name = branchName(
      "MOR-12",
      "A very long title that keeps going well past the sixty character cap",
    );
    expect(name).toBe(
      "mor-12-a-very-long-title-that-keeps-going-well-past-the",
    );
    expect(name.length).toBeLessThanOrEqual(60);
  });

  it("is always a valid git ref", () => {
    const titles = [
      "a..b",
      "x~1^2:y?z*[w]\\v",
      "ends with dot.",
      "foo.lock",
      "@{upstream}",
      "-leading dash",
      "spaces   and\ttabs\nnewlines",
      "Ünïcödé 日本語",
      "a".repeat(200),
      "word ".repeat(40),
    ];
    for (const title of titles) {
      const name = branchName("MOR-9", title);
      expect(name).toMatch(/^mor-9(-[a-z0-9]+)*$/);
      expect(name.length).toBeLessThanOrEqual(60);
    }
  });
});
