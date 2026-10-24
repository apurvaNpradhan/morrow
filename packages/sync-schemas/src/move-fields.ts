import {
  type FieldOption,
  type FieldType,
  type FieldValue,
  type FieldValues,
  isChoiceType,
  type NamedFieldValue,
  nameFieldValue,
  normalizeFieldName,
  optionsHeld,
} from "./fields.js";

type MovableField = {
  id: string;
  name: string;
  type: FieldType;
  options: readonly FieldOption[];
};

/** A value a move cannot carry, by Field name, as people write it (option names for a choice). */
export type DroppedFieldValue = { field: string; value: NamedFieldValue };

/** The values that carry over, by the destination's Field ids, and the ones that do not. */
export type CarriedFieldValues = {
  values: FieldValues;
  dropped: DroppedFieldValue[];
};

/**
 * The Field values a Task keeps when it moves to a Project with these Fields.
 * A Field carries over when the destination has one with the same name
 * (ignoring case) and type; a choice carries the options with the same name.
 * What has no match is dropped and returned by name, so the caller can show it
 * first. A multi choice keeps its matching options and drops only the rest.
 * The destination's number bounds and URL format are not applied.
 */
export function carryFieldValues(
  from: readonly MovableField[],
  to: readonly MovableField[],
  values: FieldValues,
): CarriedFieldValues {
  const carried: FieldValues = {};
  const dropped: DroppedFieldValue[] = [];
  for (const source of from) {
    const value = values[source.id] as FieldValue | undefined;
    if (value === undefined) continue;
    const target = to.find(
      (field) =>
        field.type === source.type &&
        normalizeFieldName(field.name) === normalizeFieldName(source.name),
    );
    if (!target) {
      const named = nameFieldValue(source, value);
      if (named !== undefined)
        dropped.push({ field: source.name, value: named });
      continue;
    }
    if (!isChoiceType(source.type)) {
      carried[target.id] = value;
      continue;
    }
    const kept: string[] = [];
    const lost: string[] = [];
    for (const option of optionsHeld(source, value)) {
      const match = target.options.find(
        (candidate) =>
          normalizeFieldName(candidate.name) ===
          normalizeFieldName(option.name),
      );
      if (match) kept.push(match.id);
      else lost.push(option.name);
    }
    if (kept.length > 0) {
      carried[target.id] = source.type === "single_choice" ? kept[0]! : kept;
    }
    if (lost.length > 0) {
      dropped.push({
        field: source.name,
        value: source.type === "single_choice" ? lost[0]! : lost,
      });
    }
  }
  return { values: carried, dropped };
}
