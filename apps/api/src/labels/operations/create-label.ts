import { LABEL_ID_PATTERN } from "@morrow/sync-schemas";
import { withTxid } from "#api/platform/sync/with-txid";
import { assertValidPosition } from "#api/projects/index";
import { labelError, rethrowLabelViolation } from "#api/labels/errors";
import { labelTable } from "#api/labels/tables";

export type NewLabel = {
  id: string;
  name: string;
  color: string;
  position: string;
};

/**
 * Adds a label at the position the client chose. The id and position come from
 * the browser so the label can appear before the server answers.
 */
export async function createLabel(workspaceId: string, input: NewLabel) {
  if (!LABEL_ID_PATTERN.test(input.id)) throw labelError("INVALID_LABEL_ID");
  assertValidPosition(input.position);
  try {
    const { txid } = await withTxid(async (tx) => {
      await tx.insert(labelTable).values({ ...input, workspaceId });
    });
    return { id: input.id, txid };
  } catch (error) {
    rethrowLabelViolation(error);
  }
}
