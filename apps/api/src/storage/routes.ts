import { isInlineViewable } from "@morrow/sync-schemas";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db, schema } from "#api/platform/database/index";
import { logFailure } from "#api/platform/logger";
import { authorizeAssetAccess } from "./assets/authorize-asset-access";
import { buildContentDisposition } from "./assets/content-disposition";
import { createAssetDownloadUrl } from "./lib/s3";

/**
 * Sends a member of the asset's workspace to a link that lasts a minute. The
 * bytes come from the storage service, not from here, and viewable types open
 * in place while everything else downloads as a binary file.
 */
export const storageRoutes = new Hono().get("/asset/:id", async (c) => {
  const { id } = c.req.param();
  const [asset] = await db
    .select({
      objectKey: schema.assetTable.objectKey,
      mimeType: schema.assetTable.mimeType,
      filename: schema.assetTable.filename,
      workspaceId: schema.assetTable.workspaceId,
      createdBy: schema.assetTable.createdBy,
      attachedAt: schema.assetTable.attachedAt,
    })
    .from(schema.assetTable)
    .where(eq(schema.assetTable.id, id))
    .limit(1);
  if (!asset) {
    throw new HTTPException(404, { message: "Asset not found" });
  }
  await authorizeAssetAccess(c, asset);
  // `?download=1` is the card's download button: a viewable file saves instead.
  const inline =
    isInlineViewable(asset.mimeType) && c.req.query("download") !== "1";
  try {
    const url = await createAssetDownloadUrl({
      key: asset.objectKey,
      contentDisposition: buildContentDisposition(asset.filename, inline),
      contentType: inline ? asset.mimeType : "application/octet-stream",
    });
    return new Response(null, {
      status: 302,
      headers: { Location: url, "Cache-Control": "private, max-age=50" },
    });
  } catch (error) {
    logFailure("storage.sign-asset-download", {}, error);
    throw new HTTPException(404, { message: "Asset object not found" });
  }
});
