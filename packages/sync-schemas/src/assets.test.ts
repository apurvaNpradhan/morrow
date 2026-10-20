import { describe, expect, it } from "vite-plus/test";
import {
  absoluteAssetUrls,
  assetIdsIn,
  isInlineViewable,
  isPreviewable,
  replaceAssetIds,
} from "./assets.js";

describe("assetIdsIn", () => {
  it("finds the id of an image and of a file card", () => {
    const markdown = [
      "Look: ![shot.png](/api/asset/abc123?w=1200&h=800)",
      "",
      '[report.pdf](/api/asset/def456 "application/pdf 2457600")',
    ].join("\n");
    expect(assetIdsIn(markdown)).toEqual(["abc123", "def456"]);
  });

  it("finds an absolute URL, as an agent writes it", () => {
    expect(
      assetIdsIn("![x](https://morrow.example.com/api/asset/abc123)"),
    ).toEqual(["abc123"]);
  });

  it("lists each id once and ignores other links", () => {
    expect(
      assetIdsIn(
        "![a](/api/asset/abc123) ![b](/api/asset/abc123) [c](https://example.com/asset/zzz) [d](/api/assets/nope)",
      ),
    ).toEqual(["abc123"]);
  });

  it("finds nothing in text without assets", () => {
    expect(assetIdsIn("")).toEqual([]);
    expect(assetIdsIn("plain text")).toEqual([]);
  });
});

describe("replaceAssetIds", () => {
  it("swaps only the ids it is given, whole ids only", () => {
    const markdown =
      "![a](/api/asset/abc?w=1&h=2) [f](/api/asset/abcdef) ![b](/api/asset/keep)";
    expect(replaceAssetIds(markdown, new Map([["abc", "xyz"]]))).toBe(
      "![a](/api/asset/xyz?w=1&h=2) [f](/api/asset/abcdef) ![b](/api/asset/keep)",
    );
  });
});

describe("absoluteAssetUrls", () => {
  it("prefixes relative asset links with the API URL and leaves other text alone", () => {
    expect(
      absoluteAssetUrls(
        '![a](/api/asset/abc?w=1&h=2) [f](/api/asset/def "application/pdf 10") [x](/docs/api/asset/no)',
        "https://morrow.example.com/api",
      ),
    ).toBe(
      '![a](https://morrow.example.com/api/asset/abc?w=1&h=2) [f](https://morrow.example.com/api/asset/def "application/pdf 10") [x](/docs/api/asset/no)',
    );
  });

  it("keeps links that are already absolute", () => {
    const text = "![a](https://other.example.com/api/asset/abc)";
    expect(absoluteAssetUrls(text, "https://morrow.example.com/api")).toBe(
      text,
    );
  });
});

describe("isInlineViewable", () => {
  it("opens images we recognise, PDF, video, audio and plain text in place", () => {
    for (const type of [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "video/mp4",
      "audio/mpeg",
    ]) {
      expect(isInlineViewable(type)).toBe(true);
    }
  });

  it("downloads everything that could run script or that a browser cannot show", () => {
    for (const type of [
      "image/svg+xml",
      "text/html",
      "application/xhtml+xml",
      "application/javascript",
      "application/zip",
      "application/octet-stream",
    ]) {
      expect(isInlineViewable(type)).toBe(false);
    }
  });
});

describe("isPreviewable", () => {
  it("previews what a browser shows in a frame: PDF, text, video and audio", () => {
    for (const type of [
      "application/pdf",
      "text/plain",
      "video/mp4",
      "audio/mpeg",
    ]) {
      expect(isPreviewable(type)).toBe(true);
    }
  });

  it("leaves images to the image viewer and everything unsafe to downloading", () => {
    for (const type of [
      "image/png",
      "image/svg+xml",
      "text/html",
      "application/zip",
    ]) {
      expect(isPreviewable(type)).toBe(false);
    }
  });
});
