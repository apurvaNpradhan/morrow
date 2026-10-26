import type { JSONContent, MarkdownTokenizer } from "@tiptap/core";
import { Details as TiptapDetails } from "@tiptap/extension-details";

const OPEN = "<details>\n<summary>";
const CLOSE = "</details>";

/** The index just past the `</details>` that closes the one opened at `from`. */
function matchingClose(src: string, from: number) {
  let depth = 1;
  let at = from;
  while (depth > 0) {
    const open = src.indexOf("<details>", at);
    const close = src.indexOf(CLOSE, at);
    if (close === -1) return -1;
    if (open !== -1 && open < close) {
      depth += 1;
      at = open + "<details>".length;
    } else {
      depth -= 1;
      at = close + CLOSE.length;
    }
  }
  return at;
}

/**
 * A collapsible block as GitHub writes it: `<details>`, a `<summary>` line, a
 * blank line, the body, a blank line and `</details>`.
 */
const detailsTokenizer: MarkdownTokenizer = {
  name: "details",
  level: "block",
  start: (src) => src.indexOf(OPEN),
  tokenize(src, _tokens, lexer) {
    if (!src.startsWith(OPEN)) return undefined;
    const summaryEnd = src.indexOf("</summary>\n\n", OPEN.length);
    if (summaryEnd === -1) return undefined;
    const summary = src.slice(OPEN.length, summaryEnd);
    if (summary.includes("\n")) return undefined;
    const bodyStart = summaryEnd + "</summary>\n\n".length;
    const end = matchingClose(src, bodyStart);
    if (end === -1) return undefined;
    const body = src.slice(bodyStart, end - CLOSE.length).replace(/\n+$/, "");
    return {
      type: "details",
      raw: src.slice(0, end),
      summary: lexer.inlineTokens(summary),
      children: lexer.blockTokens(body),
    };
  },
};

/** The `details` node (summary and content inside), written in GitHub's HTML form. */
export const Details = TiptapDetails.extend({
  markdownTokenizer: detailsTokenizer,

  parseMarkdown: (token, helpers) =>
    helpers.createNode("details", {}, [
      helpers.createNode(
        "detailsSummary",
        {},
        helpers.parseInline(token.summary),
      ),
      helpers.createNode(
        "detailsContent",
        {},
        helpers.parseChildren(token.children),
      ),
    ]),

  renderMarkdown: (node: JSONContent, helpers) => {
    const [summary, content] = node.content ?? [];
    return `${OPEN}${helpers.renderChildren(summary?.content ?? [])}</summary>\n\n${helpers.renderChildren(content?.content ?? [], "\n\n")}\n\n${CLOSE}`;
  },
});
