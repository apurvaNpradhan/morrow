import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { removeOwnedImage } from "#api/storage/index";
import { workspaceTable } from "#api/workspace/tables";

/**
 * The one writer of `workspace.logo`. Swaps it under a row lock, then deletes
 * the object the workspace had before (queued for retry if the delete fails).
 * Only objects under this workspace's own logo folder are deleted.
 */
export async function setWorkspaceLogo(
  workspaceId: string,
  logo: string | null,
) {
  const { result: before, txid } = await withTxid(async (tx) => {
    const [row] = await tx
      .select({ logo: workspaceTable.logo })
      .from(workspaceTable)
      .where(eq(workspaceTable.id, workspaceId))
      .for("update");
    if (!row) return null;
    await tx
      .update(workspaceTable)
      .set({ logo })
      .where(eq(workspaceTable.id, workspaceId));
    return { logo: row.logo };
  });
  const hadLogo = await removeOwnedImage(
    before?.logo ?? null,
    "workspace-logos",
    workspaceId,
  );
  return {
    hadLogo, // No row, no write, nothing to wait for.
    txid: before ? txid : null,
  };
}
