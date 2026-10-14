import { generateKeyBetween } from "fractional-indexing";
import { projectError } from "#api/projects/errors";

/**
 * Throws INVALID_POSITION unless `position` is a well-formed fractional-index
 * key. The library validates a key before extending it, so asking for the key
 * after it is the check.
 */
export function assertValidPosition(position: string) {
  try {
    generateKeyBetween(position, null);
  } catch {
    throw projectError("INVALID_POSITION");
  }
}
