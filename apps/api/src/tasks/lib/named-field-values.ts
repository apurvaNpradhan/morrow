import {
  type FieldValues,
  type NamedFieldValue,
  nameFieldValue,
} from "@morrow/sync-schemas";
import { inArray } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import { projectFieldTable } from "#api/projects/index";

type FieldRow = typeof projectFieldTable.$inferSelect;

/** The Fields of these projects, by id, for naming the values of their tasks. */
export async function fieldsOfProjects(projectIds: string[]) {
  if (projectIds.length === 0) return new Map<string, FieldRow>();
  const fields = await db
    .select()
    .from(projectFieldTable)
    .where(inArray(projectFieldTable.projectId, projectIds));
  return new Map(fields.map((field) => [field.id, field]));
}

/**
 * A task's Field values by Field name, for readers outside the web app: option
 * names for a choice, the stored value for the rest. A value whose Field or
 * option has gone is left out.
 */
export function namedFieldValues(
  values: FieldValues,
  fieldById: Map<string, FieldRow>,
): Record<string, NamedFieldValue> {
  return Object.fromEntries(
    Object.entries(values).flatMap(([fieldId, value]) => {
      const field = fieldById.get(fieldId);
      const named = field && nameFieldValue(field, value);
      return field && named !== undefined ? [[field.name, named]] : [];
    }),
  );
}
