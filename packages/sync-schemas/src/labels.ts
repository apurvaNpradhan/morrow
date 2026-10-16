/**
 * What Labels are made of, shared by the API (which validates writes) and the
 * web app (which renders them).
 */

export const LABEL_NAME_MAX = 50;

/** A Task carries at most this many Labels. */
export const MAX_TASK_LABELS = 20;

/** A cuid2 as the browser generates it when it creates a Label. */
export const LABEL_ID_PATTERN = /^[a-z][a-z0-9]{23}$/;

/** Label names are unique per Workspace once trimmed and lower-cased. */
export function normalizeLabelName(name: string) {
  return name.trim().toLowerCase();
}
