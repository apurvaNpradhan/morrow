import type { FieldConfig, FieldType } from "@morrow/sync-schemas";
import { rpc } from "@/app/lib/orpc";
import { projectFieldCollection } from "../collections/project-field-collection";

type Target = { workspaceId: string; projectId: string };

/** Adds a Field of a type at the end and waits for it to sync; resolves with its id. */
export async function createField(
  target: Target,
  field: { name: string; type: FieldType; config?: FieldConfig },
) {
  const { id, txid } = await rpc.projects.fields.create({
    ...target,
    ...field,
  });
  await projectFieldCollection.utils.awaitTxId(txid);
  return id;
}

/** Renames, repositions or reconfigures a Field; resolves when the change has synced back. */
export async function updateField(
  fieldId: string,
  patch: { name?: string; position?: string; config?: FieldConfig },
) {
  const transaction = projectFieldCollection.update(fieldId, (draft) => {
    Object.assign(draft, patch);
  });
  await transaction.isPersisted.promise;
}

/** Deletes a Field and its values on every Task. */
export async function deleteField(fieldId: string) {
  const transaction = projectFieldCollection.delete(fieldId);
  await transaction.isPersisted.promise;
}

type OptionTarget = Target & { fieldId: string };

/** Adds an option at the end of a Field; the server picks the next palette colour. */
export async function createOption(target: OptionTarget, name: string) {
  const { txid } = await rpc.projects.fields.options.create({
    ...target,
    name,
  });
  await projectFieldCollection.utils.awaitTxId(txid);
}

/** Renames, recolours or repositions an option; only the Field row is written. */
export async function updateOption(
  target: OptionTarget,
  optionId: string,
  patch: { name?: string; color?: string; position?: string },
) {
  const { position, ...rest } = patch;
  if (Object.keys(rest).length > 0) {
    const { txid } = await rpc.projects.fields.options.update({
      ...target,
      optionId,
      ...rest,
    });
    await projectFieldCollection.utils.awaitTxId(txid);
  }
  if (position !== undefined) {
    const { txid } = await rpc.projects.fields.options.move({
      ...target,
      optionId,
      position,
    });
    await projectFieldCollection.utils.awaitTxId(txid);
  }
}

/** Deletes an option and clears it from every Task that held it. */
export async function deleteOption(target: OptionTarget, optionId: string) {
  const { txid } = await rpc.projects.fields.options.remove({
    ...target,
    optionId,
  });
  await projectFieldCollection.utils.awaitTxId(txid);
}
