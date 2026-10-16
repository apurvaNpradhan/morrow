import type { ColumnColor } from "@morrow/sync-schemas";
import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockProject } from "#api/projects/lib/lock-project";
import { projectTable } from "#api/projects/tables";

type ProjectChanges = {
  name?: string;
  description?: string | null;
  icon?: string | null;
  color?: ColumnColor | null;
};

/** Changes a project's name, description, icon or colour. An empty description clears it. */
export async function updateProject(
  workspaceId: string,
  projectId: string,
  changes: ProjectChanges,
) {
  const { txid } = await withTxid(async (tx) => {
    await lockProject(tx, workspaceId, projectId);
    await tx
      .update(projectTable)
      .set({
        ...(changes.name !== undefined && { name: changes.name }),
        ...(changes.description !== undefined && {
          description: changes.description || null,
        }),
        ...(changes.icon !== undefined && { icon: changes.icon }),
        ...(changes.color !== undefined && { color: changes.color }),
      })
      .where(eq(projectTable.id, projectId));
  });
  return { txid };
}
