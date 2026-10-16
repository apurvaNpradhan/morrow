import { createId } from "@paralleldrive/cuid2";
import {
  COLUMN_COLORS,
  type ColumnColor,
  type LabelRow,
} from "@morrow/sync-schemas";
import { generateKeyBetween } from "fractional-indexing";
import { labelCollection } from "../collections/label-collection";
import { sortLabels } from "../lib/label-order";

/*
 * The writes components make. Each changes the local collection at once and
 * resolves when the change has come back through sync; if the server refuses
 * it the collection rolls back and the promise rejects.
 */

/** Adds a label at the end of the Workspace's labels; resolves with it once synced. */
export async function createLabel(input: {
  workspaceId: string;
  name: string;
  color?: ColumnColor;
}): Promise<LabelRow> {
  const existing = sortLabels(
    labelCollection.toArray.filter(
      (label) => label.workspaceId === input.workspaceId,
    ),
  );
  const now = new Date();
  const id = createId();
  const transaction = labelCollection.insert({
    id,
    workspaceId: input.workspaceId,
    name: input.name,
    // Without a choice, labels take the palette in turn.
    color:
      input.color ?? COLUMN_COLORS[existing.length % COLUMN_COLORS.length]!,
    position: generateKeyBetween(existing.at(-1)?.position ?? null, null),
    createdAt: now,
    updatedAt: now,
  });
  await transaction.isPersisted.promise;
  const created = labelCollection.get(id);
  if (!created) throw new Error("The created label did not sync");
  return created;
}

/** Renames, recolours or repositions a label; resolves when the change has synced back. */
export async function updateLabel(
  labelId: string,
  patch: { name?: string; color?: ColumnColor; position?: string },
) {
  const transaction = labelCollection.update(labelId, (draft) => {
    Object.assign(draft, patch);
  });
  await transaction.isPersisted.promise;
}

/** Deletes a label; the server removes it from every task in the same step. */
export async function deleteLabel(labelId: string) {
  await labelCollection.delete(labelId).isPersisted.promise;
}
