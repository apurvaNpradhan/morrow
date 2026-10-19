import { normalizeFieldName } from "@morrow/sync-schemas";
import { withTxid } from "#api/platform/sync/with-txid";
import { optionNotFound, projectError } from "#api/projects/errors";
import { lockProject } from "#api/projects/lib/lock-project";
import { findField } from "../lib/find-field";
import { writeOptions } from "../lib/write-options";

/**
 * Renames or recolours an option. Tasks hold the option's id, so only the
 * Field row is written and every card updates.
 */
export async function updateOption(
  workspaceId: string,
  projectId: string,
  fieldId: string,
  optionId: string,
  changes: { name?: string; color?: string },
) {
  const { txid } = await withTxid(async (tx) => {
    await lockProject(tx, workspaceId, projectId);
    const field = await findField(tx, projectId, fieldId, "update");
    if (!field.options.some((o) => o.id === optionId)) throw optionNotFound();
    if (changes.name !== undefined) {
      const name = normalizeFieldName(changes.name);
      if (
        field.options.some(
          (o) => o.id !== optionId && normalizeFieldName(o.name) === name,
        )
      ) {
        throw projectError("OPTION_NAME_TAKEN");
      }
    }
    await writeOptions(
      tx,
      fieldId,
      field.options.map((o) =>
        o.id === optionId
          ? {
              ...o,
              ...(changes.name !== undefined && { name: changes.name }),
              ...(changes.color !== undefined && { color: changes.color }),
            }
          : o,
      ),
    );
  });
  return { txid };
}
