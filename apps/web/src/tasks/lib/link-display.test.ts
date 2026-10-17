import { describe, expect, it } from "vite-plus/test";
import { faviconUrl, linkHost, linkLabel } from "./link-display";

describe("link display", () => {
  it("shows the host without www", () => {
    expect(linkHost("https://www.example.com/a/b")).toBe("example.com");
    expect(linkHost("http://docs.example.com:8080/")).toBe(
      "docs.example.com:8080",
    );
  });

  it("prefers the title, else the host and a short path", () => {
    expect(linkLabel("https://github.com/a/b/pull/1", "Fix it")).toBe("Fix it");
    expect(linkLabel("https://github.com/a/b/pull/1", null)).toBe(
      "github.com/a/b/pull/1",
    );
    expect(linkLabel("https://example.com/", null)).toBe("example.com");
    expect(
      linkLabel("https://example.com/a/very/long/path/that/goes/on", null),
    ).toBe("example.com/a/very/long/path/that/…");
  });

  it("points the favicon at the site's own icon", () => {
    expect(faviconUrl("https://example.com/a/b?c=1")).toBe(
      "https://example.com/favicon.ico",
    );
    expect(faviconUrl("nope")).toBeNull();
  });
});
