import { SNIPPET_MARK_END, SNIPPET_MARK_START } from "@morrow/sync-schemas";

export type Segment = { text: string; match: boolean };

/** The words of a query: letters and digits, as the server reads them. */
export function wordsOf(query: string) {
  return (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 8);
}

/** `text` cut so that every occurrence of a typed word is its own matching segment. */
export function splitByWords(text: string, query: string): Segment[] {
  const words = wordsOf(query);
  if (words.length === 0) return [{ text, match: false }];
  // Words hold only letters and digits, so they are literal in a pattern.
  const pattern = new RegExp(`(${words.join("|")})`, "giu");
  // Splitting on a capturing pattern alternates between and around the matches.
  return text
    .split(pattern)
    .map((part, index) => ({ text: part, match: index % 2 === 1 }))
    .filter((segment) => segment.text !== "");
}

/** A server snippet cut at the markers around its matched words. */
export function splitByMarks(snippet: string): Segment[] {
  const segments: Segment[] = [];
  let match = false;
  for (const part of snippet.split(
    new RegExp(`([${SNIPPET_MARK_START}${SNIPPET_MARK_END}])`),
  )) {
    if (part === SNIPPET_MARK_START) match = true;
    else if (part === SNIPPET_MARK_END) match = false;
    else if (part) segments.push({ text: part, match });
  }
  return segments;
}
