import { describe, expect, it } from "vite-plus/test";
import {
  assetIdOf,
  fileMarkdown,
  imageDimensions,
  imageMarkdown,
  parseCardTitle,
} from "./asset-links";

const image = {
  id: "abc123",
  filename: "shot.png",
  kind: "image" as const,
  mimeType: "image/png",
  size: 2048,
  width: 1200,
  height: 800,
};
const file = {
  id: "def456",
  filename: "report.pdf",
  kind: "file" as const,
  mimeType: "application/pdf",
  size: 2457600,
  width: null,
  height: null,
};

describe("asset markdown", () => {
  it("writes an image with its size in the link", () => {
    expect(imageMarkdown(image)).toBe(
      "![shot.png](/api/asset/abc123?w=1200&h=800)",
    );
    expect(imageMarkdown({ ...image, width: null, height: null })).toBe(
      "![shot.png](/api/asset/abc123)",
    );
  });

  it("writes a file as a link titled with its type and size", () => {
    expect(fileMarkdown(file)).toBe(
      '[report.pdf](/api/asset/def456 "application/pdf 2457600")',
    );
  });

  it("escapes the brackets of a file name", () => {
    expect(fileMarkdown({ ...file, filename: "a [draft] \\ b.pdf" })).toBe(
      '[a \\[draft\\] \\\\ b.pdf](/api/asset/def456 "application/pdf 2457600")',
    );
  });

  it("reads the id from a relative or absolute asset link", () => {
    expect(assetIdOf("/api/asset/abc123?w=1&h=2")).toBe("abc123");
    expect(assetIdOf("https://morrow.example.com/api/asset/abc123")).toBe(
      "abc123",
    );
    expect(assetIdOf("https://example.com/other.png")).toBeNull();
    expect(assetIdOf("/api/assets/abc")).toBeNull();
  });

  it("reads the pixel size from the link", () => {
    expect(imageDimensions("/api/asset/abc123?w=1200&h=800")).toEqual({
      width: 1200,
      height: 800,
    });
    expect(imageDimensions("/api/asset/abc123")).toBeNull();
    expect(imageDimensions("/api/asset/abc123?w=0&h=5")).toBeNull();
    expect(imageDimensions("/api/asset/abc123?w=x&h=5")).toBeNull();
  });

  it("reads a card's title", () => {
    expect(parseCardTitle("application/pdf 2457600")).toEqual({
      mimeType: "application/pdf",
      size: 2457600,
    });
    expect(parseCardTitle("not a card")).toBeNull();
    expect(parseCardTitle("application/pdf -1")).toBeNull();
    expect(parseCardTitle("")).toBeNull();
  });
});
