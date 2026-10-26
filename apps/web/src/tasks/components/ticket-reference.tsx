import { TicketReference as TicketReferenceNode } from "@morrow/document-schema";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TicketReferenceView } from "./ticket-reference-view";

/** The ticket reference node of the shared schema, drawn by `TicketReferenceView`. */
export const TicketReference = TicketReferenceNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TicketReferenceView);
  },
});
