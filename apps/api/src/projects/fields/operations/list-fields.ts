import { comparePosition } from "@morrow/sync-schemas";
import { and, eq } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import { projectNotFound } from "#api/projects/errors";
import { projectFieldTable, projectTable } from "#api/projects/tables";

/** A project's custom Fields in their order, each with its options in order. */
export async function listFields(workspaceId: string, projectId: string) {
  const [project] = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.id, projectId),
        eq(projectTable.workspaceId, workspaceId),
      ),
    );
  if (!project) throw projectNotFound();
  const fields = await db
    .select()
    .from(projectFieldTable)
    .where(eq(projectFieldTable.projectId, projectId));
  return fields.sort(comparePosition).map((field) => ({
    id: field.id,
    name: field.name,
    type: field.type,
    options: [...field.options]
      .sort(comparePosition)
      .map(({ id, name, color }) => ({ id, name, color })),
  }));
}
