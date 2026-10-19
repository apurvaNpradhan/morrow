import { createId } from "@paralleldrive/cuid2";
import {
  MAX_FIELD_OPTIONS,
  nextOptionColor,
  normalizeFieldName,
} from "@morrow/sync-schemas";
import { generateKeyBetween } from "fractional-indexing";
import { withTxid } from "#api/platform/sync/with-txid";
import { projectError } from "#api/projects/errors";
import { lockProject } from "#api/projects/lib/lock-project";
import { findField } from "../lib/find-field";
import { writeOptions } from "../lib/write-options";

/** Adds an option at the end of a Field's options; the colour defaults to the next in the palette. */
export async function createOption(
  workspaceId: string,
  projectId: string,
  fieldId: string,
  input: { name: string; color?: string },
) {
  const { result: id, txid } = await withTxid(async (tx) => {
    await lockProject(tx, workspaceId, projectId);
    const field = await findField(tx, projectId, fieldId, "update");
    if (field.options.length >= MAX_FIELD_OPTIONS) {
      throw projectError("OPTION_LIMIT_REACHED");
    }
    const name = normalizeFieldName(input.name);
    if (field.options.some((o) => normalizeFieldName(o.name) === name)) {
      throw projectError("OPTION_NAME_TAKEN");
    }
    const last = field.options.reduce<string | null>(
      (max, o) => (max === null || o.position > max ? o.position : max),
      null,
    );
    const option = {
      id: createId(),
      name: input.name,
      color: input.color ?? nextOptionColor(field.options),
      position: generateKeyBetween(last, null),
    };
    await writeOptions(tx, fieldId, [...field.options, option]);
    return option.id;
  });
  return { id, txid };
}
