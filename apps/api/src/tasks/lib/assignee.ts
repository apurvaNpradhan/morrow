import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import { schema } from "#api/platform/database/index";
import { taskError } from "#api/tasks/errors";

/** Who is writing: the user, and whether their role carries `task: assign`. */
export type TaskActor = {
  userId: string;
  email: string;
  canAssign: boolean;
};

/**
 * Throws unless the actor may change a task's assignee from `current` to
 * `next`. Taking a task for yourself or letting it go needs only the write
 * that was already authorised; handing it to anyone else needs `assign`. The
 * assignee must be a current Member of the Workspace.
 */
export async function assertAssignable(
  tx: DbOrTx,
  workspaceId: string,
  actor: TaskActor,
  next: string | null,
  current: string | null,
) {
  if (next === current) return;
  const onlyYourself =
    next === actor.userId || (next === null && current === actor.userId);
  if (!onlyYourself && !actor.canAssign) throw taskError("FORBIDDEN_ASSIGN");
  if (next === null) return;
  const [member] = await tx
    .select({ id: schema.workspaceUserTable.id })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
        eq(schema.workspaceUserTable.userId, next),
      ),
    );
  if (!member) throw taskError("ASSIGNEE_NOT_MEMBER");
}
