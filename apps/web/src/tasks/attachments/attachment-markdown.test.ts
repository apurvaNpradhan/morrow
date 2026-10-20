import { Markdown } from "@tiptap/markdown";
import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { AssetImage } from "./asset-image";
import { AttachmentCard } from "./attachment-card";

let editor: Editor | undefined;
afterEach(() => editor?.destroy());

function load(markdown: string) {
  editor = new Editor({
    extensions: [StarterKit, AssetImage, AttachmentCard, Markdown],
    content: markdown,
    contentType: "markdown",
  });
  return editor;
}

const CARD = '[report.pdf](/api/asset/def456 "application/pdf 2457600")';
const IMAGE = "![shot.png](/api/asset/abc123?w=1200&h=800)";

describe("attachments in markdown", () => {
  it("reads an image inside a paragraph and writes the same markdown back", () => {
    const text = `Look at ${IMAGE} here`;
    const loaded = load(text);

    const paragraph = loaded.getJSON().content![0]!;
    expect(paragraph.content![1]).toMatchObject({
      type: "assetImage",
      attrs: { src: "/api/asset/abc123?w=1200&h=800", alt: "shot.png" },
    });
    expect(loaded.getMarkdown()).toBe(text);
  });

  it("reads a link alone on its line as a card and writes the same markdown back", () => {
    const text = `Before\n\n${CARD}\n\nAfter`;
    const loaded = load(text);

    expect(loaded.getJSON().content![1]).toMatchObject({
      type: "attachmentCard",
      attrs: {
        id: "def456",
        filename: "report.pdf",
        mimeType: "application/pdf",
        size: 2457600,
      },
    });
    expect(loaded.getMarkdown()).toBe(text);
  });

  it("keeps a card whose file name has brackets", () => {
    const text = '[a \\[draft\\].pdf](/api/asset/def456 "application/pdf 10")';

    expect(load(text).getMarkdown()).toBe(text);
  });

  it("shows an absolute link the way an agent writes it, and stores it relative", () => {
    const loaded = load(
      '![x](https://morrow.example.com/api/asset/abc123?w=2&h=3)\n\n[r.pdf](https://morrow.example.com/api/asset/def456 "application/pdf 10")',
    );

    expect(loaded.getMarkdown()).toBe(
      '![x](/api/asset/abc123?w=2&h=3)\n\n[r.pdf](/api/asset/def456 "application/pdf 10")',
    );
  });

  it("leaves a file link inside a sentence an ordinary link", () => {
    const text = 'See [the report](/api/asset/def456 "application/pdf 10") now';
    const loaded = load(text);

    expect(loaded.getJSON().content![0]!.type).toBe("paragraph");
    expect(
      loaded.getJSON().content!.some((n) => n.type === "attachmentCard"),
    ).toBe(false);
    expect(loaded.getMarkdown()).toBe(text);
  });

  it("does not load images from anywhere but our own assets", () => {
    const loaded = load("![tracker](https://evil.example.com/pixel.png)");

    expect(loaded.view.dom.querySelector("img[data-asset-image]")).toBeNull();
  });

  it("renders an image with its size, lazily", () => {
    const loaded = load(IMAGE);

    const img = loaded.view.dom.querySelector("img[data-asset-image]")!;
    expect(img.getAttribute("src")).toBe("/api/asset/abc123?w=1200&h=800");
    expect(img.getAttribute("width")).toBe("1200");
    expect(img.getAttribute("height")).toBe("800");
    expect(img.getAttribute("loading")).toBe("lazy");
  });
});
