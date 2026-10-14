const MAX_KEY_LENGTH = 6;
const MIN_KEY_LENGTH = 2;

/** The words of a name, ASCII letters and digits only, upper-cased, each starting with a letter. */
function wordsOf(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .map((word) => word.replace(/^[0-9]+/, ""))
    .filter(Boolean);
}

/**
 * A project key for a name: the initials of several words (`MCA` for "My Cool
 * App"), or the first three letters of one (`MOR` for "Morrow"). A taken key
 * gets a digit (`MOR2`). Returns "" when the name has nothing to build on.
 */
export function suggestProjectKey(
  name: string,
  takenKeys: ReadonlySet<string> = new Set(),
) {
  const words = wordsOf(name);
  const raw =
    words.length > 1 ? words.map((word) => word[0]).join("") : (words[0] ?? "");
  const clipped = raw.slice(0, words.length > 1 ? MAX_KEY_LENGTH : 3);
  if (clipped.length < MIN_KEY_LENGTH) return "";
  if (!takenKeys.has(clipped)) return clipped;
  for (let n = 2; n < 10; n++) {
    const candidate = `${clipped.slice(0, MAX_KEY_LENGTH - 1)}${n}`;
    if (!takenKeys.has(candidate)) return candidate;
  }
  return clipped;
}
