import { z } from "zod";
import { authed, requireWorkspacePermission } from "#api/platform/orpc/base";
import { createAssetUpload } from "./assets/operations/create-upload";
import { finalizeAssetUpload } from "./assets/operations/finalize-upload";

const workspaceId = z.string().min(1);
const assetId = z.string().min(1).max(64);

// Anyone who can read the workspace may stage a file; the permission to write
// the content it goes into is checked when that content is saved.
const canRead = requireWorkspacePermission({ workspace: ["read"] });

const uploadSchema = z.object({
  assetId: z.string(),
  uploadUrl: z.string(),
  headers: z.record(z.string(), z.string()),
});

const assetSchema = z.object({
  id: z.string(),
  filename: z.string(),
  kind: z.enum(["image", "file"]),
  mimeType: z.string(),
  size: z.number(),
  width: z.number().nullable(),
  height: z.number().nullable(),
});

const createUpload = authed
  .input(
    z.object({
      workspaceId,
      filename: z.string().trim().min(1).max(255),
      contentType: z.string().trim().min(1).max(255),
      size: z.number().int(),
    }),
  )
  .use(canRead)
  .output(uploadSchema)
  .handler(({ input, context }) =>
    createAssetUpload(input.workspaceId, context.userId, input),
  );

const finalize = authed
  .input(z.object({ workspaceId, assetId }))
  .use(canRead)
  .output(assetSchema)
  .handler(({ input, context }) =>
    finalizeAssetUpload(input.workspaceId, context.userId, input.assetId),
  );

export const assetsRouter = { createUpload, finalize };
