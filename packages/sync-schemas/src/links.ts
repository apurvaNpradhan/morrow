/**
 * What external links on a Task are made of, shared by the API (which
 * validates writes) and the web app (which validates what it types).
 */

export const LINK_URL_MAX = 2048;
export const LINK_TITLE_MAX = 200;
export const LINKS_PER_TASK_MAX = 50;

/** A cuid2 as the browser generates it when it adds a link. */
export const LINK_ID_PATTERN = /^[a-z][a-z0-9]{23}$/;

/** Whether `value` is an http(s) address; `javascript:`, `data:` and the like are not. */
export function isHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
