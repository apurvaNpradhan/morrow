import { sql } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import { projectTable } from "#api/projects/index";
import { taskTable } from "#api/tasks/index";

/** How many tasks of the Workspace carry each label (labels in use only). */
export async function labelUsage(workspaceId: string) {
  const rows = await db.execute<{ label_id: string; count: number }>(
    sql`SELECT l AS label_id, count(*)::int AS count
        FROM ${taskTable}
        CROSS JOIN LATERAL unnest(${taskTable.labelIds}) AS l
        WHERE ${taskTable.projectId} IN (SELECT ${projectTable.id} FROM ${projectTable} WHERE ${projectTable.workspaceId} = ${workspaceId})
        GROUP BY l`,
  );
  return rows.rows.map((row) => ({ labelId: row.label_id, count: row.count }));
}
