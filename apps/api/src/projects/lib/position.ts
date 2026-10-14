import { generateKeyBetween } from "fractional-indexing";
import { projectError } from "#api/projects/errors";

const BASE_62 = /^[0-9A-Za-z]+$/;

/**
 * Throws INVALID_POSITION unless `position` is a well-formed fractional-index
 * key. The library validates a key's shape before extending it, so asking for
 * the key after it is the check; it does not look at the fraction's
 * characters, so those are checked here.
 */
export function assertValidPosition(position: string) {
  if (!BASE_62.test(position)) throw projectError("INVALID_POSITION");
  try {
    generateKeyBetween(position, null);
  } catch {
    throw projectError("INVALID_POSITION");
  }
}
