import { wordsOf } from "./highlight";

/** Whether every word of the query appears in the texts together: for what the browser already holds. */
export function matchesQuery(query: string, texts: readonly string[]) {
  const words = wordsOf(query);
  if (words.length === 0) return false;
  const haystack = texts.join(" ").toLowerCase();
  return words.every((word) => haystack.includes(word));
}
