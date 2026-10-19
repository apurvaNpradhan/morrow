import { sql } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import { taskTable } from "#api/tasks/index";

/**
 * How many Tasks of the Project hold each value of each Field (values in use
 * only), for the delete confirmations. A Field's count is the sum over its rows.
 */
export async function fieldUsage(projectId: string) {
  const rows = await db.execute<{
    field_id: string;
    option_id: string;
    count: number;
  }>(
    sql`SELECT v.key AS field_id, v.value AS option_id, count(*)::int AS count
        FROM ${taskTable}
        CROSS JOIN LATERAL jsonb_each_text(${taskTable.fieldValues}) AS v
        WHERE ${taskTable.projectId} = ${projectId}
        GROUP BY v.key, v.value`,
  );
  return rows.rows.map((row) => ({
    fieldId: row.field_id,
    optionId: row.option_id,
    count: row.count,
  }));
}
