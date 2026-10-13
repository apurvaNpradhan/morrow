import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db, schema } from "#api/platform/database/index";
import { authorizeAssetAccess } from "./assets/authorize-asset-access";
import { getPrivateObject } from "./lib/s3";
import { logFailure } from "#api/platform/logger";

const SAFE_INLINE_ASSET_TYPES = new Set([
  "image/apng",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function buildContentDisposition(filename: string, inline: boolean) {
  const normalized = filename
    .normalize("NFC")
    .replace(/[\r\n"]/g, "")
    .trim();
  const safeFilename = normalized || "file";
  const asciiFallback =
    safeFilename
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\\/]/g, "-")
      .replace(/[^\x20-\x7E]+/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "file";
  const encodedFilename = encodeURIComponent(safeFilename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  const disposition = inline ? "inline" : "attachment";
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`;
}

/** Downloads an uploaded workspace asset. Image types are served inline, everything else as an attachment. */
export const storageRoutes = new Hono().get("/asset/:id", async (c) => {
  const { id } = c.req.param();
  const [asset] = await db
    .select({
      id: schema.assetTable.id,
      objectKey: schema.assetTable.objectKey,
      mimeType: schema.assetTable.mimeType,
      filename: schema.assetTable.filename,
      surface: schema.assetTable.surface,
      workspaceId: schema.assetTable.workspaceId,
      createdBy: schema.assetTable.createdBy,
    })
    .from(schema.assetTable)
    .where(eq(schema.assetTable.id, id))
    .limit(1);

  if (!asset) {
    throw new HTTPException(404, { message: "Asset not found" });
  }

  await authorizeAssetAccess(c, asset);

  try {
    const object = await getPrivateObject(asset.objectKey);
    const storedContentType =
      (object.contentType || asset.mimeType)
        .toLowerCase()
        .split(";")[0]
        ?.trim() ?? "";
    const inline = SAFE_INLINE_ASSET_TYPES.has(storedContentType);

    return new Response(object.body as BodyInit, {
      headers: {
        "Cache-Control": "private, max-age=120",
        "Content-Disposition": buildContentDisposition(asset.filename, inline),
        "Content-Length": object.contentLength?.toString() || "",
        "Content-Type": inline ? storedContentType : "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        ETag: object.etag || "",
        "Last-Modified": object.lastModified?.toUTCString() || "",
      },
    });
  } catch (error) {
    logFailure("storage.stream-asset", {}, error);
    throw new HTTPException(404, { message: "Asset object not found" });
  }
});
