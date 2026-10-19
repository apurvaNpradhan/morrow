import { eq } from "drizzle-orm";
import { db, schema } from "../../../apps/api/src/platform/database";
import type { setupTasks } from "./tasks";

type Context = Awaited<ReturnType<typeof setupTasks>>;

/** A Field with the given options, created through the API; returns ids by option name. */
export async function addField(
  { client, base }: Pick<Context, "client" | "base">,
  name: string,
  optionNames: string[] = [],
) {
  const field = await client.projects.fields.create({ ...base, name });
  const options: Record<string, string> = {};
  for (const optionName of optionNames) {
    const option = await client.projects.fields.options.create({
      ...base,
      fieldId: field.id,
      name: optionName,
    });
    options[optionName] = option.id;
  }
  return { id: field.id, options };
}

export async function fieldRow(id: string) {
  const [row] = await db
    .select()
    .from(schema.projectFieldTable)
    .where(eq(schema.projectFieldTable.id, id));
  return row;
}

export async function fieldRows(projectId: string) {
  return db
    .select()
    .from(schema.projectFieldTable)
    .where(eq(schema.projectFieldTable.projectId, projectId));
}
