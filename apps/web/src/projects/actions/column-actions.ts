import type {
  ColumnCategory,
  ColumnColor,
  ProjectColumnRow,
} from "@morrow/sync-schemas";
import { generateKeyBetween } from "fractional-indexing";
import { rpc } from "@/app/lib/orpc";
import {
  type DeleteColumnMetadata,
  projectColumnCollection,
} from "../collections/project-column-collection";

/** The position after the last of these columns, for a column that goes to the end of its category. */
function endOfCategory(
  columns: readonly ProjectColumnRow[],
  category: ColumnCategory,
) {
  const inCategory = columns.filter((column) => column.category === category);
  return generateKeyBetween(inCategory.at(-1)?.position ?? null, null);
}

/** Adds a column at the end of its category and waits for it to sync. */
export async function createColumn(input: {
  workspaceId: string;
  projectId: string;
  name: string;
  category: ColumnCategory;
}) {
  const { txid } = await rpc.projects.columns.create(input);
  await projectColumnCollection.utils.awaitTxId(txid);
}

/** Renames, recolours or repositions a column; resolves when the change has synced back. */
export async function updateColumn(
  columnId: string,
  patch: { name?: string; color?: ColumnColor; position?: string },
) {
  const transaction = projectColumnCollection.update(columnId, (draft) => {
    Object.assign(draft, patch);
  });
  await transaction.isPersisted.promise;
}

/**
 * Moves a column into another category, at the end of it. `columns` are the
 * project's columns, to find where that is.
 */
export async function changeColumnCategory(
  columnId: string,
  category: ColumnCategory,
  columns: readonly ProjectColumnRow[],
) {
  const transaction = projectColumnCollection.update(columnId, (draft) => {
    draft.category = category;
    draft.position = endOfCategory(
      columns.filter((column) => column.id !== columnId),
      category,
    );
  });
  await transaction.isPersisted.promise;
}

/** Deletes a column; its items move to `targetColumnId` in the same step. */
export async function deleteColumn(columnId: string, targetColumnId: string) {
  const metadata: DeleteColumnMetadata = { targetColumnId };
  const transaction = projectColumnCollection.delete(columnId, { metadata });
  await transaction.isPersisted.promise;
}
