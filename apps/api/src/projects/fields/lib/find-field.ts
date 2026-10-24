import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import { isChoiceType } from "@morrow/sync-schemas";
import { fieldNotFound, projectError } from "#api/projects/errors";
import { projectFieldTable } from "#api/projects/tables";

/**
 * A Field of this project; any other Field, including another project's, is
 * "not found". `lock` keeps the row from being deleted for the rest of the
 * transaction ("share"), or takes it for a write ("update").
 */
export async function findField(
  tx: DbOrTx,
  projectId: string,
  fieldId: string,
  lock?: "share" | "update",
) {
  const query = tx
    .select()
    .from(projectFieldTable)
    .where(
      and(
        eq(projectFieldTable.id, fieldId),
        eq(projectFieldTable.projectId, projectId),
      ),
    );
  const [field] = await (lock ? query.for(lock) : query);
  if (!field) throw fieldNotFound();
  return field;
}

/** A Field that has options to edit; text, number, date and checkbox Fields have none. */
export async function findChoiceField(
  tx: DbOrTx,
  projectId: string,
  fieldId: string,
  lock?: "share" | "update",
) {
  const field = await findField(tx, projectId, fieldId, lock);
  if (!isChoiceType(field.type)) throw projectError("FIELD_HAS_NO_OPTIONS");
  return field;
}
