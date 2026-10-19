import type { FieldValues } from "@morrow/sync-schemas";
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
 * A task's Field values as option name by Field name, for readers outside the
 * web app. A value whose Field or option has gone is left out.
 */
export function namedFieldValues(
  values: FieldValues,
  fieldById: Map<string, FieldRow>,
) {
  return Object.fromEntries(
    Object.entries(values).flatMap(([fieldId, optionId]) => {
      const field = fieldById.get(fieldId);
      const option = field?.options.find((o) => o.id === optionId);
      return field && option ? [[field.name, option.name]] : [];
    }),
  );
}
