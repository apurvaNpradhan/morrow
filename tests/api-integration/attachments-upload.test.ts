import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import {
  assetRow,
  objectExists,
  pdfBytes,
  pngBytes,
  uploadAsset,
} from "./helpers/assets";
import { resetTestDatabase } from "./helpers/database";
import { as, rejection, setupWorkspace } from "./helpers/projects";

beforeEach(resetTestDatabase);

const png = (filename = "shot.png", bytes = pngBytes()) => ({
  filename,
  contentType: "image/png",
  bytes,
});

describe("asking for an upload", () => {
  it("creates a draft owned by the caller and returns a presigned PUT", async () => {
    const { client, owner, workspace } = await setupWorkspace();

    const upload = await client.assets.createUpload({
      workspaceId: workspace.id,
      filename: "shot.png",
      contentType: "image/png",
      size: 64,
    });

    expect(
      new URL(upload.uploadUrl).searchParams.get("X-Amz-Signature"),
    ).toBeTruthy();
    expect(await assetRow(upload.assetId)).toMatchObject({
      workspaceId: workspace.id,
      filename: "shot.png",
      size: 64,
      createdBy: owner.id,
      taskId: null,
      attachedAt: null,
    });
  });

  it("refuses a file over 100 MB and an empty one", async () => {
    const { client, workspace } = await setupWorkspace();
    const ask = (size: number) =>
      client.assets.createUpload({
        workspaceId: workspace.id,
        filename: "big.bin",
        contentType: "application/octet-stream",
        size,
      });

    expect((await rejection(ask(100 * 1024 * 1024 + 1))).data?.code).toBe(
      "UPLOAD_TOO_LARGE",
    );
    expect((await rejection(ask(0))).data?.code).toBe("UPLOAD_INVALID");
  });

  it("refuses a 21st open draft, and lets go of one once it is gone", async () => {
    const { client, workspace } = await setupWorkspace();
    const ask = () =>
      client.assets.createUpload({
        workspaceId: workspace.id,
        filename: "a.png",
        contentType: "image/png",
        size: 10,
      });
    const first = await ask();
    for (let i = 1; i < 20; i++) await ask();

    const refused = await rejection(ask());
    expect(refused.data?.code).toBe("TOO_MANY_UPLOADS");

    // Someone else's drafts do not count against this user.
    const teammate = as(await addWorkspaceMember(workspace.id, "member"));
    await teammate.assets.createUpload({
      workspaceId: workspace.id,
      filename: "b.png",
      contentType: "image/png",
      size: 10,
    });

    // A draft that expires or is claimed no longer counts.
    await db
      .delete(schema.assetTable)
      .where(eq(schema.assetTable.id, first.assetId));
    await expect(ask()).resolves.toBeTruthy();
  });

  it("refuses someone who is not a member of the workspace", async () => {
    const { workspace } = await setupWorkspace();
    const other = await setupWorkspace();

    const refused = await rejection(
      other.client.assets.createUpload({
        workspaceId: workspace.id,
        filename: "a.png",
        contentType: "image/png",
        size: 10,
      }),
    );

    expect(refused.code).toBe("NOT_FOUND");
  });
});

describe("finishing an upload", () => {
  it("makes an image of PNG bytes and reads its size", async () => {
    const { client, workspace } = await setupWorkspace();
    const assetId = await uploadAsset(client, workspace.id, png());

    const asset = await client.assets.finalize({
      workspaceId: workspace.id,
      assetId,
    });

    expect(asset).toEqual({
      id: assetId,
      filename: "shot.png",
      kind: "image",
      mimeType: "image/png",
      size: 64,
      width: 1200,
      height: 800,
    });
    expect(await assetRow(assetId)).toMatchObject({
      kind: "image",
      width: 1200,
      height: 800,
      attachedAt: null,
    });
  });

  it("keeps the declared type of a file, and does not trust a .png name over PDF bytes", async () => {
    const { client, workspace } = await setupWorkspace();
    const fake = await uploadAsset(client, workspace.id, {
      filename: "looks-like.png",
      contentType: "image/png",
      bytes: pdfBytes(),
    });
    const report = await uploadAsset(client, workspace.id, {
      filename: "report.pdf",
      contentType: "application/pdf",
      bytes: pdfBytes(),
    });

    const faked = await client.assets.finalize({
      workspaceId: workspace.id,
      assetId: fake,
    });
    const real = await client.assets.finalize({
      workspaceId: workspace.id,
      assetId: report,
    });

    expect(faked).toMatchObject({ kind: "file", width: null, height: null });
    expect(real).toMatchObject({ kind: "file", mimeType: "application/pdf" });
  });

  it("shows an image over 20 MB as a file", async () => {
    const { client, workspace } = await setupWorkspace();
    const assetId = await uploadAsset(
      client,
      workspace.id,
      png("huge.png", pngBytes(8000, 6000, 21 * 1024 * 1024)),
    );

    const asset = await client.assets.finalize({
      workspaceId: workspace.id,
      assetId,
    });

    expect(asset).toMatchObject({ kind: "file", mimeType: "image/png" });
  });

  it("is for the uploader only", async () => {
    const { client, workspace } = await setupWorkspace();
    const assetId = await uploadAsset(client, workspace.id, png());
    const teammate = as(await addWorkspaceMember(workspace.id, "member"));

    const refused = await rejection(
      teammate.assets.finalize({ workspaceId: workspace.id, assetId }),
    );

    expect(refused.data?.code).toBe("ASSET_NOT_FOUND");
  });

  it("says so when nothing was uploaded", async () => {
    const { client, workspace } = await setupWorkspace();
    const { assetId } = await client.assets.createUpload({
      workspaceId: workspace.id,
      filename: "never.png",
      contentType: "image/png",
      size: 10,
    });

    const refused = await rejection(
      client.assets.finalize({ workspaceId: workspace.id, assetId }),
    );

    expect(refused.data?.code).toBe("UPLOAD_MISSING");
  });

  it("removes an object whose size is not the declared one", async () => {
    const { client, workspace } = await setupWorkspace();
    const assetId = await uploadAsset(
      client,
      workspace.id,
      png("a.png", pngBytes(1, 1, 40)),
    );
    // The row claims more than the object holds.
    await db
      .update(schema.assetTable)
      .set({ size: 99 })
      .where(eq(schema.assetTable.id, assetId));
    const { objectKey } = (await assetRow(assetId))!;

    const refused = await rejection(
      client.assets.finalize({ workspaceId: workspace.id, assetId }),
    );

    expect(refused.data?.code).toBe("UPLOAD_INVALID");
    expect(await objectExists(objectKey)).toBe(false);
    expect(await assetRow(assetId)).toBeUndefined();
  });
});
