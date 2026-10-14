import { eq, isNotNull, and } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import { ownedImageKey } from "#api/storage/index";
import { projectTable } from "#api/projects/tables";

/**
 * The storage objects behind the background images of a workspace's projects.
 * Read before the workspace is deleted: the rows go with it, and with them the
 * only record of which objects to remove.
 */
export async function projectBackgroundKeys(
  database: DbOrTx,
  workspaceId: string,
) {
  const rows = await database
    .select({ id: projectTable.id, url: projectTable.backgroundUrl })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        isNotNull(projectTable.backgroundUrl),
      ),
    );
  return rows.flatMap((row) => {
    const key = ownedImageKey(row.url, "project-backgrounds", row.id);
    return key ? [key] : [];
  });
}
