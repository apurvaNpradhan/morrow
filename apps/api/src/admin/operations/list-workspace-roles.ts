import { DEFAULT_ROLE_NAMES } from "@morrow/permissions";
import { asc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "#api/platform/database/index";
import {
  workspaceRoleTable,
  workspaceTable,
} from "#api/platform/database/schema";

export async function listWorkspaceRoles(workspaceId: string) {
  const [workspace] = await db
    .select({ id: workspaceTable.id })
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId))
    .limit(1);
  if (!workspace) {
    throw new ORPCError("NOT_FOUND", { message: "Workspace not found" });
  }

  const custom = await db
    .select({ role: workspaceRoleTable.role })
    .from(workspaceRoleTable)
    .where(eq(workspaceRoleTable.workspaceId, workspaceId))
    .orderBy(asc(workspaceRoleTable.role));

  return [
    ...new Set([
      ...DEFAULT_ROLE_NAMES,
      ...custom.map((row) => row.role).filter((role) => role !== "owner"),
    ]),
  ];
}
