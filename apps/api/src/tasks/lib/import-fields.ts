import { createId } from "@paralleldrive/cuid2";
import {
  colorHex,
  FIELD_NAME_MAX,
  FIELD_TYPES,
  type FieldOption,
  type FieldType,
  type FieldValues,
  MAX_FIELD_OPTIONS,
  MAX_PROJECT_FIELDS,
  nextOptionColor,
  normalizeFieldName,
} from "@morrow/sync-schemas";
import { eq } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import type { DbOrTx } from "#api/members/index";
import { projectFieldTable } from "#api/projects/index";
import type { ImportWarning } from "#api/tasks/response";

type DeclaredField = {
  name: string;
  type?: string;
  options: { name: string; color?: string }[];
};

type Working = {
  id: string;
  name: string;
  type: FieldType;
  position: string;
  options: FieldOption[];
  isNew: boolean;
  changed: boolean;
};

const isFieldType = (type: string): type is FieldType =>
  (FIELD_TYPES as readonly string[]).includes(type);

/**
 * Matches an imported document's Fields and options to the Project's by name
 * ignoring case. A missing Field or option is created when the importer may
 * define Fields (`project: update`), else the value naming it is dropped and
 * counted for a warning. Declared Fields and options are created even when no
 * Task uses them, so an empty Field survives a round trip. Everything happens
 * in memory until `save`, which writes the new Fields and the options added to
 * old ones, all under the caller's Project lock.
 */
export async function importFields(
  tx: DbOrTx,
  projectId: string,
  canDefine: boolean,
  declared: readonly DeclaredField[],
) {
  const existing = await tx
    .select()
    .from(projectFieldTable)
    .where(eq(projectFieldTable.projectId, projectId));
  const byName = new Map<string, Working>(
    existing.map((row) => [
      normalizeFieldName(row.name),
      { ...row, options: [...row.options], isNew: false, changed: false },
    ]),
  );
  let lastPosition = existing.reduce<string | null>(
    (max, row) => (max === null || row.position > max ? row.position : max),
    null,
  );
  const droppedFields = new Map<string, number>();
  const droppedOptions = new Map<
    string,
    { field: string; option: string; count: number }
  >();

  function findOrCreateField(name: string, type = "single_choice") {
    const known = byName.get(normalizeFieldName(name));
    if (known) return known;
    if (
      !canDefine ||
      name === "" ||
      name.length > FIELD_NAME_MAX ||
      !isFieldType(type) ||
      byName.size >= MAX_PROJECT_FIELDS
    ) {
      return undefined;
    }
    lastPosition = generateKeyBetween(lastPosition, null);
    const field: Working = {
      id: createId(),
      name,
      type,
      position: lastPosition,
      options: [],
      isNew: true,
      changed: true,
    };
    byName.set(normalizeFieldName(name), field);
    return field;
  }

  function findOrCreateOption(field: Working, name: string, color?: string) {
    const known = field.options.find(
      (option) => normalizeFieldName(option.name) === normalizeFieldName(name),
    );
    if (known) return known;
    if (
      !canDefine ||
      name === "" ||
      name.length > FIELD_NAME_MAX ||
      field.options.length >= MAX_FIELD_OPTIONS
    ) {
      return undefined;
    }
    const last = field.options.reduce<string | null>(
      (max, option) =>
        max === null || option.position > max ? option.position : max,
      null,
    );
    const option: FieldOption = {
      id: createId(),
      name,
      color:
        color !== undefined && colorHex.safeParse(color).success
          ? color
          : nextOptionColor(field.options),
      position: generateKeyBetween(last, null),
    };
    field.options.push(option);
    field.changed = true;
    return option;
  }

  for (const definition of declared) {
    const field = findOrCreateField(definition.name.trim(), definition.type);
    if (!field) continue;
    for (const option of definition.options) {
      findOrCreateOption(field, option.name.trim(), option.color);
    }
  }

  const colorOf = (fieldName: string, optionName: string) =>
    declared
      .find((f) => normalizeFieldName(f.name) === normalizeFieldName(fieldName))
      ?.options.find(
        (o) => normalizeFieldName(o.name) === normalizeFieldName(optionName),
      )?.color;

  /** A Task's imported values, by Field and option name, as stored values. */
  function valuesFor(imported: Record<string, string>): FieldValues {
    const values: FieldValues = {};
    for (const [rawField, rawOption] of Object.entries(imported)) {
      const fieldName = rawField.trim();
      const optionName = rawOption.trim();
      const field = findOrCreateField(fieldName);
      if (!field) {
        droppedFields.set(fieldName, (droppedFields.get(fieldName) ?? 0) + 1);
        continue;
      }
      const option = findOrCreateOption(
        field,
        optionName,
        colorOf(fieldName, optionName),
      );
      if (!option) {
        const key = `${field.id}\u0000${normalizeFieldName(optionName)}`;
        const known = droppedOptions.get(key);
        droppedOptions.set(key, {
          field: field.name,
          option: optionName,
          count: (known?.count ?? 0) + 1,
        });
        continue;
      }
      values[field.id] = option.id;
    }
    return values;
  }

  async function save() {
    for (const field of byName.values()) {
      if (!field.changed) continue;
      if (field.isNew) {
        await tx.insert(projectFieldTable).values({
          id: field.id,
          projectId,
          name: field.name,
          type: field.type,
          position: field.position,
          options: field.options,
        });
      } else {
        await tx
          .update(projectFieldTable)
          .set({ options: field.options })
          .where(eq(projectFieldTable.id, field.id));
      }
    }
  }

  function warnings(): ImportWarning[] {
    return [
      ...[...droppedFields].map(([field, count]): ImportWarning => ({
        kind: "field_dropped",
        field,
        count,
      })),
      ...[...droppedOptions.values()].map((dropped): ImportWarning => ({
        kind: "option_dropped",
        ...dropped,
      })),
    ];
  }

  return { valuesFor, save, warnings };
}
