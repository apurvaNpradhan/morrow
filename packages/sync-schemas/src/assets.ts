/** The largest file an attachment may be (100 MB). */
export const ASSET_MAX_BYTES = 100 * 1024 * 1024;

/** How many uploads one person may have waiting to be saved into a text. */
export const ASSET_MAX_OPEN_DRAFTS = 20;

/** An image above this size is shown as a file card, not inline (20 MB). */
export const ASSET_INLINE_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

/** The URL path of an asset in markdown, relative or absolute. */
const ASSET_URL = /\/api\/asset\/([a-z0-9]+)/g;

/** The asset ids a markdown text links to, each once, in order of appearance. */
export function assetIdsIn(markdown: string): string[] {
  return [...new Set([...markdown.matchAll(ASSET_URL)].map((m) => m[1]!))];
}

/** The markdown with asset ids swapped for the ones in `replacements`. */
export function replaceAssetIds(
  markdown: string,
  replacements: ReadonlyMap<string, string>,
): string {
  return markdown.replace(ASSET_URL, (whole, id: string) => {
    const next = replacements.get(id);
    return next ? `/api/asset/${next}` : whole;
  });
}

/**
 * The markdown with relative asset links made absolute, for readers that are
 * not the web app (agents fetch the files with their token). `apiUrl` is the
 * public API URL, ending in `/api`.
 */
export function absoluteAssetUrls(markdown: string, apiUrl: string): string {
  const base = apiUrl.replace(/\/+$/, "");
  return markdown.replace(/(?<![\w/.:-])\/api\/asset\//g, `${base}/asset/`);
}

/**
 * Whether a browser may show a file in place instead of downloading it. Only
 * types that cannot run script: the four image formats we recognise, PDF,
 * video, audio and plain text. SVG, HTML and the rest download.
 */
export function isInlineViewable(mimeType: string): boolean {
  return (
    mimeType === "image/png" ||
    mimeType === "image/jpeg" ||
    mimeType === "image/gif" ||
    mimeType === "image/webp" ||
    mimeType === "application/pdf" ||
    mimeType === "text/plain" ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("audio/")
  );
}
