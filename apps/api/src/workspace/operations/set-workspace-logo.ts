import { eq } from "drizzle-orm";
import { db } from "#api/platform/database/index";
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
  const previous = await db.transaction(async (tx) => {
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
    return row.logo;
  });
  const hadLogo = await removeOwnedImage(
    previous,
    "workspace-logos",
    workspaceId,
  );
  return { hadLogo };
}
