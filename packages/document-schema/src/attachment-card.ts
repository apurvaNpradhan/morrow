import { Node } from "@tiptap/core";
import { assetPath } from "./asset-links";
import { attachmentCardTokenizer } from "./asset-tokenizers";

/**
 * A file on its own line in a description or page. One block atom whose
 * markdown is `[name](/api/asset/id "type size")`, so any other reader sees a
 * working link. The editor draws it with `AttachmentCardView`.
 */
export const AttachmentCard = Node.create({
  name: "attachmentCard",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      id: { default: "" },
      filename: { default: "" },
      mimeType: { default: "application/octet-stream" },
      size: { default: 0 },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='attachment-card']" }];
  },

  renderHTML({ node }) {
    return [
      "div",
      {
        "data-type": "attachment-card",
        "data-id": node.attrs.id,
      },
      node.attrs.filename,
    ];
  },

  markdownTokenizer: attachmentCardTokenizer,

  parseMarkdown: (token) => ({
    type: "attachmentCard",
    attrs: {
      id: token.id,
      filename: token.filename,
      mimeType: token.mimeType,
      size: token.size,
    },
  }),

  renderMarkdown: (node) => {
    const { id, filename, mimeType, size } = node.attrs ?? {};
    const name = String(filename ?? "").replace(/[\\[\]]/g, "\\$&");
    return `[${name}](${assetPath(String(id))} "${mimeType} ${size}")`;
  },
});
