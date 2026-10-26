/** What the editor needs to know about an uploaded file. */
export type UploadedAsset = {
  id: string;
  filename: string;
  kind: "image" | "file";
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
};

const ASSET_PATH = /(?:^|\/\/[^/\s]+)\/api\/asset\/([a-z0-9]+)(?:[?#]|$)/;
const escapeText = (text: string) => text.replace(/[\\[\]]/g, "\\$&");

/** The link an asset has in markdown: relative, so it works wherever the app is served. */
export function assetPath(id: string) {
  return `/api/asset/${id}`;
}

/** `![name](/api/asset/id?w=..&h=..)`: the size lets the page reserve room before the image loads. */
export function imageMarkdown(asset: UploadedAsset) {
  const size =
    asset.width && asset.height ? `?w=${asset.width}&h=${asset.height}` : "";
  return `![${escapeText(asset.filename)}](${assetPath(asset.id)}${size})`;
}

/** `[name](/api/asset/id "type size")`, which the editor shows as a card when it stands alone. */
export function fileMarkdown(asset: UploadedAsset) {
  return `[${escapeText(asset.filename)}](${assetPath(asset.id)} "${asset.mimeType} ${asset.size}")`;
}

/** The asset id in a link, relative or absolute; null for any other URL. */
export function assetIdOf(href: string) {
  return ASSET_PATH.exec(href)?.[1] ?? null;
}

/** The pixel size an image link carries, if it has one. */
export function imageDimensions(src: string) {
  const query = src.split("?")[1] ?? "";
  const params = new URLSearchParams(query);
  const width = Number(params.get("w"));
  const height = Number(params.get("h"));
  return Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0
    ? { width, height }
    : null;
}

/** The type and size in a card link's title; null when the title is anything else. */
export function parseCardTitle(title: string) {
  const match = /^([^\s"]+\/[^\s"]+) (\d+)$/.exec(title);
  return match ? { mimeType: match[1]!, size: Number(match[2]) } : null;
}
