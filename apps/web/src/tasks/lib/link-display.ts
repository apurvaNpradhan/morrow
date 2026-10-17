/** The host of a link without `www.`, or the text itself when it is not a URL. */
export function linkHost(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const SHORT_PATH = 24;

/** What a link is called when it has no title: its host and a short path. */
export function linkLabel(url: string, title: string | null) {
  if (title) return title;
  try {
    const { pathname } = new URL(url);
    const path = pathname === "/" ? "" : pathname.replace(/\/$/, "");
    const short =
      path.length > SHORT_PATH ? `${path.slice(0, SHORT_PATH - 1)}…` : path;
    return `${linkHost(url)}${short}`;
  } catch {
    return url;
  }
}

/** Where a site keeps its icon; fetched by the browser, never by the server. */
export function faviconUrl(url: string) {
  try {
    return `${new URL(url).origin}/favicon.ico`;
  } catch {
    return null;
  }
}
