import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import { projectError, projectNotFound } from "#api/projects/errors";
import { projectTable } from "#api/projects/tables";

/**
 * Locks a project's row for the rest of the transaction and returns it. The
 * project must belong to the workspace the caller was authorised for; anything
 * else is "not found", as is a project of another workspace. An archived
 * project refuses the write unless the caller says it may touch one.
 */
export async function lockProject(
  tx: DbOrTx,
  workspaceId: string,
  projectId: string,
  { allowArchived = false }: { allowArchived?: boolean } = {},
) {
  const [project] = await tx
    .select()
    .from(projectTable)
    .where(
      and(
        eq(projectTable.id, projectId),
        eq(projectTable.workspaceId, workspaceId),
      ),
    )
    .for("update");
  if (!project) throw projectNotFound();
  if (project.archivedAt && !allowArchived) {
    throw projectError("PROJECT_ARCHIVED");
  }
  return project;
}
