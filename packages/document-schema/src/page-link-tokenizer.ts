import type { MarkdownTokenizer } from "@tiptap/core";

const PAGE_LINK = /^\[\[([a-z0-9]+)(?:\|((?:[^\]\\|\n]|\\.)*))?\]\]/;

const unescapeTitle = (text: string) => text.replace(/\\([\\[\]|])/g, "$1");

/** `[[pageId]]` or `[[pageId|title]]` in running text. */
export const pageLinkTokenizer: MarkdownTokenizer = {
  name: "pageLink",
  level: "inline",
  start: (src) => src.indexOf("[["),
  tokenize(src) {
    const match = PAGE_LINK.exec(src);
    if (!match) return undefined;
    return {
      type: "pageLink",
      raw: match[0],
      docId: match[1]!,
      title: unescapeTitle(match[2] ?? ""),
    };
  },
};
