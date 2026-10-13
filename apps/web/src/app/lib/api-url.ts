/**
 * The API origin: `VITE_API_URL` when the API is hosted elsewhere, otherwise
 * the page's own origin (the API serves the web app, or the dev server proxies
 * it). Outside a browser there is no page, so it falls back to localhost.
 */
export function resolveApiOrigin(viteApiUrl: string | undefined): string {
  if (viteApiUrl) return viteApiUrl;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://localhost:1337";
}

/**
 * Resolves the Hono client base URL from `VITE_API_URL` (or the page origin).
 * If the value already ends with `/api`, it is returned as-is; otherwise `/api` is appended.
 */
export function resolveApiBaseUrl(viteApiUrl: string | undefined): string {
  const baseUrl = resolveApiOrigin(viteApiUrl).replace(/\/+$/, "");
  return baseUrl.endsWith("/api") ? baseUrl : `${baseUrl}/api`;
}
