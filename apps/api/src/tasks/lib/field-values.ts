import {
  FIELD_VALUE_SCHEMAS,
  type FieldValues,
  fieldValuesSchema,
} from "@morrow/sync-schemas";
import { eq } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import { fieldNotFound, projectFieldTable } from "#api/projects/index";
import { taskError } from "#api/tasks/errors";

type FieldRow = typeof projectFieldTable.$inferSelect;

/**
 * The value as it is stored, once it is the right type for the Field and, for a
 * choice, one of its options; anything else is INVALID_FIELD_VALUE.
 */
export function checkFieldValue(field: FieldRow, value: unknown) {
  const parsed = FIELD_VALUE_SCHEMAS[field.type].safeParse(value);
  if (!parsed.success) throw taskError("INVALID_FIELD_VALUE");
  if (!field.options.some((option) => option.id === parsed.data)) {
    throw taskError("INVALID_FIELD_VALUE");
  }
  return parsed.data;
}

/**
 * Checks a whole set of values for a new Task: every key a Field of the
 * Project, every value valid for it. The Project lock the caller holds keeps a
 * Field delete out until the Task is written.
 */
export async function checkFieldValues(
  tx: DbOrTx,
  projectId: string,
  values: FieldValues,
): Promise<FieldValues> {
  const parsed = fieldValuesSchema.safeParse(values);
  if (!parsed.success) throw taskError("INVALID_FIELD_VALUE");
  const entries = Object.entries(parsed.data);
  if (entries.length === 0) return {};
  const fields = await tx
    .select()
    .from(projectFieldTable)
    .where(eq(projectFieldTable.projectId, projectId));
  const byId = new Map(fields.map((field) => [field.id, field]));
  return Object.fromEntries(
    entries.map(([fieldId, value]) => {
      const field = byId.get(fieldId);
      if (!field) throw fieldNotFound();
      return [fieldId, checkFieldValue(field, value)];
    }),
  );
}
