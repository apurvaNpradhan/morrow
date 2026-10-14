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

  const byProject = new Map<
    string,
    (typeof columns)[number]["project_column"][]
  >();
  for (const { project_column: column } of columns) {
    byProject.set(column.projectId, [
      ...(byProject.get(column.projectId) ?? []),
      column,
    ]);
  }
  return projects.sort(comparePosition).map((project) => ({
    ...project,
    columns: (byProject.get(project.id) ?? []).sort(compareColumns),
  }));
}
