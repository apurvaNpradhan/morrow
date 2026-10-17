import { describe, expect, it } from "vite-plus/test";
import { branchName } from "./branch-name";

describe("branchName", () => {
  it("joins the ticket id and the title", () => {
    expect(branchName("MOR-12", "External links on a task")).toBe(
      "mor-12-external-links-on-a-task",
    );
  });

  it("collapses punctuation and drops emoji", () => {
    expect(branchName("MOR-3", "Fix: the  *login*  bug!! 🐛")).toBe(
      "mor-3-fix-the-login-bug",
    );
  });

  it("removes accents", () => {
    expect(branchName("MOR-4", "Café Ünïcode naïve")).toBe(
      "mor-4-cafe-unicode-naive",
    );
  });

  it("is just the ticket id for a title with no letters or digits", () => {
    expect(branchName("MOR-5", "!!! ???")).toBe("mor-5");
    expect(branchName("MOR-5", "")).toBe("mor-5");
  });

  it("cuts a long title at a word boundary within 60 characters", () => {
    const name = branchName(
      "MOR-12",
      "A very long title that keeps going well past what any branch name should hold",
    );
    expect(name.length).toBeLessThanOrEqual(60);
    expect(name).toBe(
      "mor-12-a-very-long-title-that-keeps-going-well-past-what-any",
    );
    expect(name.endsWith("-")).toBe(false);
  });

  it("cuts a single enormous word where it stands", () => {
    const name = branchName("MOR-1", "x".repeat(100));
    expect(name).toHaveLength(60);
  });

  it.each([
    "a..b ~ c^d:e?f*g[h\\i .lock",
    "trailing dot.",
    "x.lock",
    "   spaces   ",
    "../../etc/passwd",
    "-leading and trailing-",
    "@{upstream}",
    "tab\tand\nnewline",
  ])("always gives a valid git ref for %j", (title) => {
    const name = branchName("MOR-9", title);
    expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(name).not.toMatch(/\.\.|[~^:?*[\\\s]|\.$|\.lock$|^-|-$/);
  });
});
