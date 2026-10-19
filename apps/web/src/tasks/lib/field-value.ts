import {
  type FieldOption,
  optionOf,
  type ProjectFieldRow,
} from "@morrow/sync-schemas";

/**
 * The option a task holds for a Field, or undefined when it holds none or the
 * id is no longer one of the Field's options (an unknown id is ignored, as a
 * missing key is).
 */
export function optionHeld(
  field: ProjectFieldRow,
  fieldValues: Readonly<Record<string, string>>,
): FieldOption | undefined {
  return optionOf(field, fieldValues[field.id]);
}

/** The Fields a task has a value for, with the option, in Field order. */
export function heldFields(
  fields: readonly ProjectFieldRow[],
  fieldValues: Readonly<Record<string, string>>,
) {
  return fields.flatMap((field) => {
    const option = optionHeld(field, fieldValues);
    return option ? [{ field, option }] : [];
  });
}
