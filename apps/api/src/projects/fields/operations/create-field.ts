import {
  type FieldConfig,
  type FieldType,
  MAX_PROJECT_FIELDS,
  parseFieldConfig,
} from "@morrow/sync-schemas";
import { count, eq, max } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import { withTxid } from "#api/platform/sync/with-txid";
import { projectError, rethrowViolation } from "#api/projects/errors";
import { lockProject } from "#api/projects/lib/lock-project";
import { projectFieldTable } from "#api/projects/tables";

/** Adds a Field at the end of the Project's Fields, with no options yet. A config the type does not allow is refused. */
export async function createField(
  workspaceId: string,
  projectId: string,
  input: { name: string; type: FieldType; config?: FieldConfig },
) {
  const config = parseFieldConfig(input.type, input.config ?? {});
  if (!config) throw projectError("INVALID_FIELD_CONFIG");
  try {
    const { result: id, txid } = await withTxid(async (tx) => {
      await lockProject(tx, workspaceId, projectId);
      const [last] = await tx
        .select({ position: max(projectFieldTable.position), count: count() })
        .from(projectFieldTable)
        .where(eq(projectFieldTable.projectId, projectId));
      if ((last?.count ?? 0) >= MAX_PROJECT_FIELDS) {
        throw projectError("FIELD_LIMIT_REACHED");
      }
      const [field] = await tx
        .insert(projectFieldTable)
        .values({
          projectId,
          name: input.name,
          type: input.type,
          config,
          position: generateKeyBetween(last?.position ?? null, null),
        })
        .returning({ id: projectFieldTable.id });
      if (!field) throw new Error("Field insert returned no row");
      return field.id;
    });
    return { id, txid };
  } catch (error) {
    rethrowViolation(error, {
      project_field_project_name_uidx: "FIELD_NAME_TAKEN",
    });
  }
}
