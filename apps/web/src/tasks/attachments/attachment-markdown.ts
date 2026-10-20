import type { MarkdownTokenizer } from "@tiptap/react";
import { assetIdOf, assetPath, parseCardTitle } from "./asset-markdown";

/** An asset link, relative or absolute (an agent writes absolute ones). */
const ASSET_URL = String.raw`(?:https?:\/\/[^/\s)]+)?\/api\/asset\/[a-z0-9]+`;
const LABEL = String.raw`((?:[^\]\\]|\\.)*)`;

const IMAGE = new RegExp(
  String.raw`^!\[${LABEL}\]\((${ASSET_URL}(?:\?[^\s)]*)?)\)`,
);
const CARD = new RegExp(
  String.raw`^\[${LABEL}\]\((${ASSET_URL})[ \t]+"([^"]*)"\)[ \t]*(?:\n|$)`,
);

const CARD_LINE_START = new RegExp(
  String.raw`^\[(?:[^\]\\\n]|\\.)*\]\(${ASSET_URL}[ \t]+"`,
  "m",
);

export const unescapeText = (text: string) =>
  text.replace(/\\([\\[\]])/g, "$1");

/**
 * `![name](/api/asset/id?w=..&h=..)`. Only our own assets become images: any
 * other image stays text, so a pasted remote image cannot load from a stranger's
 * server when a task is opened.
 */
export const assetImageTokenizer: MarkdownTokenizer = {
  name: "assetImage",
  level: "inline",
  start: (src) => src.indexOf("!["),
  tokenize(src) {
    const match = IMAGE.exec(src);
    const id = match && assetIdOf(match[2]!);
    if (!match || !id) return undefined;
    const query = match[2]!.split("?")[1];
    return {
      type: "assetImage",
      raw: match[0],
      alt: unescapeText(match[1]!),
      src: `${assetPath(id)}${query ? `?${query}` : ""}`,
    };
  },
};

/**
 * A file link standing alone on its line: `[name](/api/asset/id "type size")`.
 * The same link inside a sentence, or with a title that is not a type and a
 * size, stays an ordinary link.
 */
export const attachmentCardTokenizer: MarkdownTokenizer = {
  name: "attachmentCard",
  level: "block",
  // Marked cuts a paragraph where this says a card may start, so it must only
  // find a line that begins with an asset link, never a bracket inside a sentence.
  start: (src) => CARD_LINE_START.exec(src)?.index ?? -1,
  tokenize(src) {
    const match = CARD.exec(src);
    const id = match && assetIdOf(match[2]!);
    const title = match && parseCardTitle(match[3]!);
    if (!match || !id || !title) return undefined;
    return {
      type: "attachmentCard",
      raw: match[0],
      id,
      filename: unescapeText(match[1]!),
      mimeType: title.mimeType,
      size: title.size,
    };
  },
};
