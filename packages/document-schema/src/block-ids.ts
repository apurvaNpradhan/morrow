import { Extension, type JSONContent } from "@tiptap/core";
import { isBlockId } from "./validators";

/** The block types that carry an id. Rows and cells do not: nobody edits them alone. */
export const BLOCK_ID_TYPES = [
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "table",
  "details",
  "attachmentCard",
];

/**
 * The `blockId` attribute on every block type. The attribute is only declared
 * here; a client gives ids to the blocks it creates (Tiptap's UniqueID, set to
 * `attributeName: "blockId"`), and the page job repairs the rest.
 */
export const BlockIds = Extension.create({
  name: "blockIds",

  addGlobalAttributes() {
    return [
      {
        types: BLOCK_ID_TYPES,
        attributes: {
          blockId: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-block-id"),
            renderHTML: (attributes) =>
              attributes.blockId ? { "data-block-id": attributes.blockId } : {},
          },
        },
      },
    ];
  },
});

/**
 * A copy of the document in which every block has a unique id: the first
 * block to hold an id keeps it, and a block with none, a malformed one or a
 * repeat gets a new one.
 */
export function assignBlockIds(
  doc: JSONContent,
  newId: () => string = () => crypto.randomUUID(),
): JSONContent {
  const seen = new Set<string>();
  const visit = (node: JSONContent): JSONContent => {
    const content = node.content?.map(visit);
    let attrs = node.attrs;
    if (node.type && BLOCK_ID_TYPES.includes(node.type)) {
      const current = node.attrs?.blockId;
      const keep = isBlockId(current) && !seen.has(current);
      const blockId = keep ? current : newId();
      seen.add(blockId);
      attrs = { ...node.attrs, blockId };
    }
    return {
      ...node,
      ...(attrs && { attrs }),
      ...(content && { content }),
    };
  };
  return visit(doc);
}
