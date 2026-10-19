import { withTxid } from "#api/platform/sync/with-txid";
import { optionNotFound, projectError } from "#api/projects/errors";
import { lockProject } from "#api/projects/lib/lock-project";
import { assertValidPosition } from "#api/projects/lib/position";
import { findField } from "../lib/find-field";
import { writeOptions } from "../lib/write-options";

/** Moves an option to the position the client chose. */
export async function moveOption(
  workspaceId: string,
  projectId: string,
  fieldId: string,
  optionId: string,
  position: string,
) {
  assertValidPosition(position);
  const { txid } = await withTxid(async (tx) => {
    await lockProject(tx, workspaceId, projectId);
    const field = await findField(tx, projectId, fieldId, "update");
    if (!field.options.some((o) => o.id === optionId)) throw optionNotFound();
    if (
      field.options.some((o) => o.id !== optionId && o.position === position)
    ) {
      throw projectError("POSITION_TAKEN");
    }
    await writeOptions(
      tx,
      fieldId,
      field.options.map((o) => (o.id === optionId ? { ...o, position } : o)),
    );
  });
  return { txid };
}
