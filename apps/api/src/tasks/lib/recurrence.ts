import {
  parseRecurrence,
  rebaseRecurrence,
  recurrenceText,
  type Recurrence,
  type TaskDate,
} from "@morrow/sync-schemas";
import { eq } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import { schema } from "#api/platform/database/index";
import { taskError } from "#api/tasks/errors";

/** The due date of a task row as a `TaskDate`, or null. */
export function dueOf(task: { dueAt: Date | null; dueHasTime: boolean }) {
  return task.dueAt ? { at: task.dueAt, hasTime: task.dueHasTime } : null;
}

/** The time zone a user chose, else UTC: the server cannot see their browser's. */
export async function zoneOfUser(tx: DbOrTx, userId: string | null) {
  if (userId === null) return "UTC";
  const [user] = await tx
    .select({ timeZone: schema.userTable.timeZone })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId));
  return user?.timeZone ?? "UTC";
}

/** The rule in `text`, which must be one Morrow accepts and begin on `due`; else a typed refusal. */
export function assertRecurrence(
  text: string,
  due: TaskDate | null,
): Recurrence {
  if (due === null) throw taskError("RECURRENCE_NEEDS_DUE_DATE");
  const parsed = parseRecurrence(text, due);
  if (!parsed.ok) {
    throw taskError("INVALID_RECURRENCE", { reason: parsed.reason });
  }
  return parsed.recurrence;
}

/**
 * What a change of due date does to the task's rule: the rule follows the new
 * date, and goes with it when the date is cleared. `after` is the due date the
 * change leaves; `zone` writes a rule on days that gets a moment.
 */
export function recurrenceAfterDueChange(
  recurrence: string | null,
  before: TaskDate | null,
  after: TaskDate | null,
  zone: string,
) {
  if (recurrence === null || before === null) return recurrence;
  if (after === null) return null;
  const parsed = parseRecurrence(recurrence, before);
  // A rule that no longer parses cannot follow anything; it goes.
  if (!parsed.ok) return null;
  return recurrenceText(rebaseRecurrence(parsed.recurrence, after, zone));
}
