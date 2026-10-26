import { mergeAttributes, Node } from "@tiptap/core";
import { pageLinkTokenizer } from "./page-link-tokenizer";

/**
 * A link to another page of the Workspace. One inline atom whose markdown is
 * `[[pageId|title]]`: the id is the target and the title only what the page
 * was called when it was linked, shown while the tree has no better name.
 */
export const PageLink = Node.create({
  name: "pageLink",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      docId: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-doc-id") ?? "",
      },
      title: {
        default: "",
        parseHTML: (element) => element.textContent ?? "",
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-type='page-link'][data-doc-id]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "page-link",
        "data-doc-id": node.attrs.docId,
      }),
      node.attrs.title,
    ];
  },

  markdownTokenizer: pageLinkTokenizer,

  parseMarkdown: (token) => ({
    type: "pageLink",
    attrs: { docId: token.docId, title: token.title },
  }),

  renderMarkdown: (node) => {
    const { docId, title } = node.attrs ?? {};
    const name = String(title ?? "").replace(/[\\[\]|]/g, "\\$&");
    return name ? `[[${docId}|${name}]]` : `[[${docId}]]`;
  },
});
