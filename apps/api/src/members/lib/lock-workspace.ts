import { eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { schema } from "#api/platform/database/index";
import type { DbOrTx } from "./db-or-tx";

export async function lockWorkspace(database: DbOrTx, workspaceId: string) {
  const [workspace] = await database
    .select({ id: schema.workspaceTable.id })
    .from(schema.workspaceTable)
    .where(eq(schema.workspaceTable.id, workspaceId))
    .for("update");
  if (!workspace) {
    throw new ORPCError("NOT_FOUND", { message: "Workspace not found" });
  }

  return database
    .select({
      userId: schema.workspaceUserTable.userId,
      role: schema.workspaceUserTable.role,
    })
    .from(schema.workspaceUserTable)
    .where(eq(schema.workspaceUserTable.workspaceId, workspaceId))
    .orderBy(schema.workspaceUserTable.id)
    .for("update");
}
