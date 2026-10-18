import { parseTicketId, ticketId } from "@morrow/sync-schemas";
import type { MarkdownTokenizer } from "@tiptap/react";

/**
 * A ticket id in running text: uppercase only, so ordinary prose such as
 * `utf-8` stays text, and not part of a longer word, a path or a `key-number`.
 */
const TICKET_IN_TEXT =
  /(?<![\p{L}\p{N}_/-])[A-Z][A-Z0-9]{1,5}-[1-9]\d{0,8}(?![\p{L}\p{N}_])/u;
const TICKET_AT_START = /^[A-Z][A-Z0-9]{1,5}-[1-9]\d{0,8}(?![\p{L}\p{N}_])/u;

/**
 * Reads `MOR-12` in markdown as a ticket reference. The markdown is the plain
 * id, so the stored text never changes; whether it links is decided on screen.
 */
export const ticketReferenceTokenizer: MarkdownTokenizer = {
  name: "ticketReference",
  level: "inline",
  start: (src) => src.search(TICKET_IN_TEXT),
  tokenize(src) {
    const raw = TICKET_AT_START.exec(src)?.[0];
    if (!raw) return undefined;
    const ticket = parseTicketId(raw);
    if (!ticket) return undefined;
    return {
      type: "ticketReference",
      raw,
      ticketId: ticketId(ticket.key, ticket.number),
    };
  },
};
