import { DEFAULT_ROLE_NAMES } from "@morrow/permissions";
import { and, eq } from "drizzle-orm";
import { schema } from "#api/platform/database/index";
import type { DbOrTx } from "#api/members/index";

export async function isAssignableWorkspaceRole(
  database: DbOrTx,
  workspaceId: string,
  role: string,
): Promise<boolean> {
  if (role.includes(",") || role === "owner") return false;
  if ((DEFAULT_ROLE_NAMES as readonly string[]).includes(role)) return true;

  const [custom] = await database
    .select({ id: schema.workspaceRoleTable.id })
    .from(schema.workspaceRoleTable)
    .where(
      and(
        eq(schema.workspaceRoleTable.workspaceId, workspaceId),
        eq(schema.workspaceRoleTable.role, role),
      ),
    )
    .limit(1);
  return Boolean(custom);
}
