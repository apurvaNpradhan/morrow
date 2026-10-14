import { compareColumns, comparePosition } from "@morrow/sync-schemas";
import { eq } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import { projectColumnTable, projectTable } from "#api/projects/tables";

/** A workspace's projects in their shared order, each with its columns in board order. */
export async function listProjects(workspaceId: string) {
  const projects = await db
    .select()
    .from(projectTable)
    .where(eq(projectTable.workspaceId, workspaceId));
  const columns = await db
    .select()
    .from(projectColumnTable)
    .innerJoin(projectTable, eq(projectTable.id, projectColumnTable.projectId))
    .where(eq(projectTable.workspaceId, workspaceId));

  return projects.sort(comparePosition).map((project) => ({
    ...project,
    columns: columns
      .filter((row) => row.project_column.projectId === project.id)
      .map((row) => row.project_column)
      .sort(compareColumns),
  }));
}
