import { mergeAttributes, Node } from "@tiptap/react";
import { imageDimensions } from "./asset-markdown";
import { assetImageTokenizer } from "./attachment-markdown";

/**
 * An uploaded image in a description or comment. One atom in the text whose
 * markdown is `![name](/api/asset/id?w=..&h=..)`; the size in the link lets the
 * browser keep room for it while it loads.
 */
export const AssetImage = Node.create({
  name: "assetImage",
  group: "inline",
  inline: true,
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "img[data-asset-image]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const size = imageDimensions(node.attrs.src);
    return [
      "img",
      mergeAttributes(HTMLAttributes, {
        class: "morrow-editor-image",
        "data-asset-image": "",
        src: node.attrs.src,
        alt: node.attrs.alt,
        loading: "lazy",
        decoding: "async",
        ...(size && { width: size.width, height: size.height }),
      }),
    ];
  },

  markdownTokenizer: assetImageTokenizer,

  parseMarkdown: (token) => ({
    type: "assetImage",
    attrs: { src: token.src, alt: token.alt },
  }),

  renderMarkdown: (node) =>
    `![${String(node.attrs?.alt ?? "").replace(/[\\[\]]/g, "\\$&")}](${node.attrs?.src ?? ""})`,
});
