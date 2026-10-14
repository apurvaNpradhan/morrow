import { describe, expect, it } from "vite-plus/test";
import { PROJECT_KEY_PATTERN } from "@morrow/sync-schemas";
import { suggestProjectKey } from "./suggest-project-key";

describe("suggestProjectKey", () => {
  it("takes the first three letters of a single word", () => {
    expect(suggestProjectKey("Morrow")).toBe("MOR");
  });

  it("takes the initials of several words", () => {
    expect(suggestProjectKey("My Cool App")).toBe("MCA");
    expect(suggestProjectKey("Website redesign")).toBe("WR");
  });

  it("ignores punctuation and accents", () => {
    expect(suggestProjectKey("  Café-Ünïcode!  ")).toBe("CU");
    expect(suggestProjectKey("a/b/c")).toBe("ABC");
  });

  it("never starts with a digit", () => {
    expect(suggestProjectKey("2025 plan")).toBe("PLA");
    expect(suggestProjectKey("2025")).toBe("");
    expect(suggestProjectKey("42nd Street")).toBe("NS");
  });

  it("suggests nothing when the name has too little to go on", () => {
    expect(suggestProjectKey("")).toBe("");
    expect(suggestProjectKey("A")).toBe("");
    expect(suggestProjectKey("日本語")).toBe("");
  });

  it("uses at most six characters", () => {
    expect(suggestProjectKey("a b c d e f g h")).toBe("ABCDEF");
  });

  it("adds a digit when the key is taken", () => {
    expect(suggestProjectKey("Morrow", new Set(["MOR"]))).toBe("MOR2");
    expect(suggestProjectKey("Morrow", new Set(["MOR", "MOR2"]))).toBe("MOR3");
    expect(suggestProjectKey("a b c d e f", new Set(["ABCDEF"]))).toBe(
      "ABCDE2",
    );
  });

  it("always suggests a valid key", () => {
    for (const name of ["Morrow", "My Cool App", "x y", "Ünï côdé", "A1 B2"]) {
      const key = suggestProjectKey(name);
      expect(key).toMatch(PROJECT_KEY_PATTERN);
    }
  });
});
