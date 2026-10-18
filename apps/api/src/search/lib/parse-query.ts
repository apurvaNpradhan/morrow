const MAX_WORDS = 8;
const MAX_WORD_LENGTH = 64;

export type ParsedQuery = {
  words: string[];
  /** A `to_tsquery` string: every word a prefix term, all required. */
  tsquery: string;
  /** The words as one lowercase string, for trigram matching. */
  text: string;
};

/**
 * What a person typed, reduced to letters and digits, so no character of it
 * can act as `tsquery` syntax or an `ILIKE` wildcard. Null when no word is
 * left. Filters such as `assignee:me` would be recognised here.
 */
export function parseQuery(input: string): ParsedQuery | null {
  const words = (
    input
      .normalize("NFKC")
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  )
    .slice(0, MAX_WORDS)
    .map((word) => word.slice(0, MAX_WORD_LENGTH));
  if (words.length === 0) return null;
  return {
    words,
    tsquery: words.map((word) => `${word}:*`).join(" & "),
    text: words.join(" "),
  };
}
