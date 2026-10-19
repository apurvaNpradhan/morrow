import { describe, expect, it } from "vite-plus/test";
import { emojiOfIcon, filterEmojis, loadEmojis } from "./project-emojis";

describe("filterEmojis", () => {
  const emojis = [
    { emoji: "🚀", label: "rocket", tags: ["launch", "space"] },
    { emoji: "🌮", label: "taco", tags: ["mexican"] },
  ];

  it("returns every emoji for an empty query", () => {
    expect(filterEmojis(emojis, "  ")).toEqual(emojis);
  });

  it("matches the name or a keyword, ignoring case", () => {
    expect(filterEmojis(emojis, "ROCK").map((e) => e.emoji)).toEqual(["🚀"]);
    expect(filterEmojis(emojis, "mexican").map((e) => e.emoji)).toEqual(["🌮"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterEmojis(emojis, "zzzz")).toEqual([]);
  });
});

describe("loadEmojis", () => {
  it("lists the emoji without skin-tone modifiers", async () => {
    const all = await loadEmojis();
    expect(all.length).toBeGreaterThan(1500);
    expect(all.some((entry) => entry.emoji === "🚀")).toBe(true);
    expect(all.some((entry) => entry.label.includes("skin tone"))).toBe(false);
  });
});

describe("emojiOfIcon", () => {
  it("returns an emoji and nothing for a Lucide name or no icon", () => {
    expect(emojiOfIcon("🚀")).toBe("🚀");
    expect(emojiOfIcon("Rocket")).toBeNull();
    expect(emojiOfIcon(null)).toBeNull();
  });

  it("accepts flags and joined sequences but not two emoji or text", () => {
    expect(emojiOfIcon("🇮🇳")).toBe("🇮🇳");
    expect(emojiOfIcon("👩‍💻")).toBe("👩‍💻");
    expect(emojiOfIcon("🚀🚀")).toBeNull();
    expect(emojiOfIcon("a")).toBeNull();
  });
});
