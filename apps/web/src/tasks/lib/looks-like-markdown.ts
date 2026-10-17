/** Block and inline markers that plain prose rarely contains. */
const MARKERS = [
  /^#{1,6}\s+\S/m, // heading
  /^\s*(?:[-*+]|\d+[.)])\s+\S/m, // bullet or numbered list
  /^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]/m, // task list
  /^\s*>\s?\S/m, // quote
  /^\s*```/m, // code fence
  /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/m, // divider
  /\*\*[^*\n]+\*\*/, // bold
  /(?<![\w*])_[^_\n]+_(?![\w*])/, // italic with underscores
  /~~[^~\n]+~~/, // strikethrough
  /`[^`\n]+`/, // inline code
  /\[[^\]\n]+\]\([^)\s]+\)/, // link
];

/**
 * Whether pasted plain text is probably markdown, so the editor should parse
 * it instead of inserting it as literal text. One marker is enough: someone
 * who pastes "## Plan" or "- [ ] item" means the formatting.
 */
export function looksLikeMarkdown(text: string) {
  return MARKERS.some((marker) => marker.test(text));
}
