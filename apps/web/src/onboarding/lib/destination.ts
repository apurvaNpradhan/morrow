/** Splits an app href into the pieces the router's `navigate`/`redirect` take. */
export function toNavigation(href: string) {
  const url = new URL(href, "http://morrow.invalid");
  return {
    to: url.pathname,
    search: Object.fromEntries(url.searchParams),
    hash: url.hash ? url.hash.slice(1) : undefined,
  };
}
