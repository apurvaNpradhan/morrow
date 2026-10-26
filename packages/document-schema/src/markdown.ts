import type { JSONContent } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";
import { documentExtensions } from "./extensions";

const manager = new MarkdownManager({ extensions: documentExtensions });

/** A page's ProseMirror JSON from markdown. Block ids are not in markdown. */
export function markdownToJSON(markdown: string): JSONContent {
  return manager.parse(markdown);
}

/** Markdown from a page's ProseMirror JSON. Block ids are not written. */
export function jsonToMarkdown(doc: JSONContent): string {
  return manager.serialize(doc).trim();
}
