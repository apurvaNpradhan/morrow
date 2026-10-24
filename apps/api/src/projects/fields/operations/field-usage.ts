import { sql } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import { taskTable } from "#api/tasks/index";

/**
 * How many Tasks of the Project hold a value for each Field (`optionId` null)
 * and, for choice Fields, how many hold each option, for the delete
 * confirmations. Only values in use are listed.
 */
export async function fieldUsage(projectId: string) {
  const rows = await db.execute<{
    field_id: string;
    option_id: string | null;
    count: number;
  }>(
    sql`SELECT v.key AS field_id, NULL::text AS option_id, count(*)::int AS count
        FROM ${taskTable}
        CROSS JOIN LATERAL jsonb_each(${taskTable.fieldValues}) AS v
        WHERE ${taskTable.projectId} = ${projectId}
        GROUP BY v.key
        UNION ALL
        SELECT v.key, e.id, count(*)::int
        FROM ${taskTable}
        CROSS JOIN LATERAL jsonb_each(${taskTable.fieldValues}) AS v
        JOIN project_field f ON f.id = v.key AND f.type IN ('single_choice', 'multi_choice')
        CROSS JOIN LATERAL jsonb_array_elements_text(
          CASE jsonb_typeof(v.value) WHEN 'array' THEN v.value ELSE jsonb_build_array(v.value) END
        ) AS e(id)
        WHERE ${taskTable.projectId} = ${projectId}
        GROUP BY v.key, e.id`,
  );
  return rows.rows.map((row) => ({
    fieldId: row.field_id,
    optionId: row.option_id,
    count: row.count,
  }));
}
