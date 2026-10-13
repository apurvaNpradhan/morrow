import { errorMessageKey } from "./orpc-error";
import type { TFunction } from "i18next";

/**
 * The translated text for a failed call: the API's typed code when it has a
 * message of its own, otherwise `fallback`. The error's own text is never
 * shown; it is server wording, not copy.
 */
export function errorMessage(
  t: TFunction,
  error: unknown,
  fallback: string,
): string {
  const key = errorMessageKey(error);
  // defaultValue keeps an error that lands before the locale has loaded
  // readable instead of showing the raw key.
  return key === "common:errors.unknown"
    ? fallback
    : t(key, { defaultValue: fallback });
}
