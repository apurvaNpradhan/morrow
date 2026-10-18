/** Where the user was before Settings or a full-page task: pathname + search. */
export type ReturnLocation = { pathname: string; search: string };

let current: ReturnLocation | null = null;

export function getReturnLocation() {
  return current;
}

// The last page outside Settings, including a full-page task: Settings leaves here.
let beforeSettings: ReturnLocation | null = null;

export function getSettingsReturnLocation() {
  return beforeSettings;
}

export function setReturnLocation(next: ReturnLocation | null) {
  current = next;
  beforeSettings = next;
}

const SETTINGS = /^\/[^/]+\/settings(\/|$)/;
const FULL_PAGE_TASK = /^\/[^/]+\/tasks\/[^/]+\/?$/;

/** Settings pages and full-page tasks are places to leave, never to return to. */
export function isReturnable(pathname: string) {
  return !SETTINGS.test(pathname) && !FULL_PAGE_TASK.test(pathname);
}

/** Records each resolved location that is a place to come back to. */
export function recordLocation(location: ReturnLocation) {
  if (!SETTINGS.test(location.pathname)) beforeSettings = location;
  if (!isReturnable(location.pathname)) return;
  // An open sheet is not part of the place: leaving brings back the page alone.
  const search = new URLSearchParams(location.search);
  search.delete("task");
  const rest = search.toString();
  setReturnLocation({
    pathname: location.pathname,
    search: rest ? `?${rest}` : "",
  });
}

/**
 * The stored location if it still makes sense: it is in this workspace and, for
 * a project page, the project still exists. Otherwise null.
 */
export function usableReturnLocation(
  stored: ReturnLocation | null,
  slug: string,
  projectKeys: ReadonlySet<string>,
) {
  if (!stored) return null;
  const [, first, section, key] = stored.pathname.split("/");
  if (first !== slug) return null;
  if (section === "projects" && key && !projectKeys.has(key)) return null;
  return stored;
}
