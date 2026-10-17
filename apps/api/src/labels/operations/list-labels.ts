import { asc, eq } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import { labelTable } from "#api/labels/tables";

/** A Workspace's labels in their order. Read on the server for MCP. */
export async function listLabels(workspaceId: string) {
  return db
    .select({
      id: labelTable.id,
      name: labelTable.name,
      color: labelTable.color,
      position: labelTable.position,
    })
    .from(labelTable)
    .where(eq(labelTable.workspaceId, workspaceId))
    .orderBy(asc(labelTable.position));
}
