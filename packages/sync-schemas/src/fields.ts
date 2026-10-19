import { z } from "zod";
import { COLUMN_COLORS, colorHex } from "./projects.js";

/**
 * What custom Fields are made of, shared by the API (which validates writes)
 * and the web app (which renders them). A Field belongs to a Project; a Task
 * keeps its values in `fieldValues`, keyed by Field id, and a value that is not
 * set is a missing key, never `null`.
 */

/** v1 has one type; the others follow in MOR-44. */
export const FIELD_TYPES = ["single_choice"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_NAME_MAX = 50;
export const MAX_PROJECT_FIELDS = 20;
export const MAX_FIELD_OPTIONS = 50;

/** Field and option names are unique once trimmed and lower-cased. */
export function normalizeFieldName(name: string) {
  return name.trim().toLowerCase();
}

/** One choice of a choice Field. Tasks store `id`, so editing the rest rewrites no Task. */
export const fieldOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: colorHex,
  position: z.string(),
});
export type FieldOption = z.infer<typeof fieldOptionSchema>;

/** The value schema of each type: what `fieldValues[fieldId]` holds. */
export const FIELD_VALUE_SCHEMAS = {
  /** The id of one of the Field's options. */
  single_choice: z.string().min(1),
} as const satisfies Record<FieldType, z.ZodType>;

/** What a Task row carries: a value per Field id; unset Fields are absent. */
export const fieldValuesSchema = z.record(z.string(), z.string());
export type FieldValues = z.infer<typeof fieldValuesSchema>;

/** The next palette colour for a new option: the first not yet used, else cycling. */
export function nextOptionColor(options: readonly { color: string }[]) {
  const used = new Set(options.map((option) => option.color));
  return (
    COLUMN_COLORS.find((color) => !used.has(color)) ??
    COLUMN_COLORS[options.length % COLUMN_COLORS.length]!
  );
}

/**
 * Whether a stored value is an option the Field still has. The web app uses it
 * to ignore unknown option ids and keys of Fields that are gone.
 */
export function optionOf(
  field: { options: readonly FieldOption[] },
  value: string | undefined,
) {
  return value === undefined
    ? undefined
    : field.options.find((option) => option.id === value);
}
