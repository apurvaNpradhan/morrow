import { describe, expect, it } from "vite-plus/test";
import { matchesSearch } from "./search";

const task = {
  title: "Write the Docs",
  number: 12,
};

describe("matchesSearch", () => {
  it("matches the title, ignoring case", () => {
    expect(matchesSearch(task, "MOR", "docs")).toBe(true);
    expect(matchesSearch(task, "MOR", "THE DOC")).toBe(true);
    expect(matchesSearch(task, "MOR", "missing")).toBe(false);
  });

  it("matches the ticket number in all three forms", () => {
    expect(matchesSearch(task, "MOR", "MOR-12")).toBe(true);
    expect(matchesSearch(task, "MOR", "mor-12")).toBe(true);
    expect(matchesSearch(task, "MOR", "#12")).toBe(true);
    expect(matchesSearch(task, "MOR", "12")).toBe(true);
    expect(matchesSearch(task, "MOR", "#1")).toBe(false);
    expect(matchesSearch(task, "MOR", "WEB-12")).toBe(false);
  });

  it("matches everything for an empty search", () => {
    expect(matchesSearch(task, "MOR", "   ")).toBe(true);
  });
});
