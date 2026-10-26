import { mergeAttributes, Node } from "@tiptap/core";
import { ticketReferenceTokenizer } from "./ticket-reference-tokenizer";

/**
 * A ticket id such as `MOR-12` in a description or page. It is one atom whose
 * markdown is the plain id; the view links it when it names a task of the
 * Workspace and shows the plain id otherwise.
 */
export const TicketReference = Node.create({
  name: "ticketReference",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      ticketId: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-ticket-id") ?? "",
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-type='ticket-reference'][data-ticket-id]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "ticket-reference",
        "data-ticket-id": node.attrs.ticketId,
      }),
      node.attrs.ticketId,
    ];
  },

  markdownTokenizer: ticketReferenceTokenizer,

  parseMarkdown: (token) => ({
    type: "ticketReference",
    attrs: { ticketId: token.ticketId },
  }),

  renderMarkdown: (node) => String(node.attrs?.ticketId ?? ""),
});
