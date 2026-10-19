import type { FieldOption } from "@morrow/sync-schemas";
import { eq } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import { projectFieldTable } from "#api/projects/tables";

/** Replaces a Field's options; the only write an option edit makes. */
export async function writeOptions(
  tx: DbOrTx,
  fieldId: string,
  options: FieldOption[],
) {
  await tx
    .update(projectFieldTable)
    .set({ options })
    .where(eq(projectFieldTable.id, fieldId));
}
