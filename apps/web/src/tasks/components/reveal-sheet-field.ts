/**
 * Sent on `window` by a field shortcut when the sheet has no chip for that
 * field because the task has no value for it: the properties rail adds the
 * chip and opens it. The detail is the chip's `data-sheet-field`, or `field`
 * for the first Field without a value.
 */
export const REVEAL_SHEET_FIELD = "morrow:reveal-sheet-field";

export function revealSheetField(name: string) {
  window.dispatchEvent(new CustomEvent(REVEAL_SHEET_FIELD, { detail: name }));
}
