import { describe, expect, it } from "vite-plus/test";
import {
  createDefaultSlug,
  getSlugIssue,
  workspaceSlugSchema,
} from "./workspace-slug";

describe("workspaceSlugSchema", () => {
  it.each(["abc", "my-team", "team-42", "a".repeat(40)])(
    "accepts %s",
    (slug) => {
      expect(workspaceSlugSchema.safeParse(slug).success).toBe(true);
    },
  );

  it.each([
    "ab",
    "a".repeat(41),
    "-abc",
    "abc-",
    "a--b",
    "Abc",
    "a b",
    "a_b",
    "",
  ])("rejects %j as invalid", (slug) => {
    expect(getSlugIssue(slug)).toBe("invalid");
  });

  it.each([
    "new",
    "settings",
    "admin",
    "auth",
    "api",
    "invitation",
    "inbox",
    "search",
  ])("flags %s as reserved", (slug) => {
    expect(getSlugIssue(slug)).toBe("reserved");
  });

  it("returns null for a usable slug", () => {
    expect(getSlugIssue("my-team")).toBeNull();
  });
});

describe("createDefaultSlug", () => {
  it("lowercases and hyphenates", () => {
    expect(createDefaultSlug("My Team!")).toBe("my-team");
  });

  it("collapses runs and trims hyphens", () => {
    expect(createDefaultSlug("  --Hello___World--  ")).toBe("hello-world");
  });

  it("trims to the length limit without a trailing hyphen", () => {
    const slug = createDefaultSlug(`${"a".repeat(39)} bbbb`);
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("transliterates accented letters", () => {
    expect(createDefaultSlug("Café Müller")).toBe("cafe-muller");
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(createDefaultSlug("!!!")).toBe("");
  });
});
