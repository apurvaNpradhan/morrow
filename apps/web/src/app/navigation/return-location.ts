/** Where the user was before Settings or a full-page task: pathname + search. */
export type ReturnLocation = { pathname: string; search: string };

let current: ReturnLocation | null = null;

export function getReturnLocation() {
  return current;
}

export function setReturnLocation(next: ReturnLocation | null) {
  current = next;
}

const SETTINGS = /^\/[^/]+\/settings(\/|$)/;
const FULL_PAGE_TASK = /^\/[^/]+\/tasks\/[^/]+\/?$/;

/** Settings pages and full-page tasks are places to leave, never to return to. */
export function isReturnable(pathname: string) {
  return !SETTINGS.test(pathname) && !FULL_PAGE_TASK.test(pathname);
}

/** Records each resolved location that is a place to come back to. */
export function recordLocation(location: ReturnLocation) {
  if (isReturnable(location.pathname)) {
    setReturnLocation({ pathname: location.pathname, search: location.search });
  }
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
