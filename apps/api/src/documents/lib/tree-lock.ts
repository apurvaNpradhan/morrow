import { and, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import {
  projectError,
  projectNotFound,
  projectTable,
} from "#api/projects/index";
import { documentError, documentNotFound } from "../errors";
import { documentTable } from "../tables";

/**
 * Serializes the writes that change a Workspace's page tree (create under a
 * page, move, archive, restore, delete) for the rest of the transaction. A
 * move checks that its target is not inside the subtree it moves, and two
 * moves checking at once could each pass and make a loop; tree writes are rare
 * enough for one lock per Workspace.
 */
export async function lockTree(tx: DbOrTx, workspaceId: string) {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`documents:${workspaceId}`}))`,
  );
}

/**
 * A page of this Workspace, locked for the rest of the transaction; a page of
 * another Workspace is "not found". An archived page refuses the write unless
 * the caller says it may touch one.
 */
export async function lockDocument(
  tx: DbOrTx,
  workspaceId: string,
  documentId: string,
  { allowArchived = false }: { allowArchived?: boolean } = {},
) {
  const [document] = await tx
    .select()
    .from(documentTable)
    .where(
      and(
        eq(documentTable.id, documentId),
        eq(documentTable.workspaceId, workspaceId),
      ),
    )
    .for("update");
  if (!document) throw documentNotFound();
  if (document.archivedAt && !allowArchived) {
    throw documentError("DOCUMENT_ARCHIVED");
  }
  return document;
}

/**
 * Refuses a write into an archived Project, which is read-only until it is
 * restored. A page at the Workspace root has no Project to be archived.
 */
export async function assertProjectWritable(
  tx: DbOrTx,
  workspaceId: string,
  projectId: string | null,
) {
  if (projectId === null) return;
  const [project] = await tx
    .select({ archivedAt: projectTable.archivedAt })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.id, projectId),
        eq(projectTable.workspaceId, workspaceId),
      ),
    );
  if (!project) throw projectNotFound();
  if (project.archivedAt) throw projectError("PROJECT_ARCHIVED");
}
