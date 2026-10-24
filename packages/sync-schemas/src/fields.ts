import { z } from "zod";
import { isHttpUrl } from "./links.js";
import { COLUMN_COLORS, colorHex } from "./projects.js";
import { isCalendarDate } from "./tasks.js";

/**
 * What custom Fields are made of, shared by the API (which validates writes)
 * and the web app (which renders them). A Field belongs to a Project; a Task
 * keeps its values in `fieldValues`, keyed by Field id, and a value that is not
 * set is a missing key, never `null`.
 */

export const FIELD_TYPES = [
  "single_choice",
  "multi_choice",
  "text",
  "number",
  "date",
  "checkbox",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** The types whose values are options of the Field. */
export const CHOICE_FIELD_TYPES = ["single_choice", "multi_choice"] as const;
export type ChoiceFieldType = (typeof CHOICE_FIELD_TYPES)[number];

export function isChoiceType(type: FieldType): type is ChoiceFieldType {
  return type === "single_choice" || type === "multi_choice";
}

export const FIELD_NAME_MAX = 50;
export const MAX_PROJECT_FIELDS = 20;
export const MAX_FIELD_OPTIONS = 50;
export const FIELD_TEXT_MAX = 200;
export const FIELD_UNIT_MAX = 8;
/** Beyond this a number loses integer precision in JSON and in the filters. */
export const FIELD_NUMBER_LIMIT = 1e15;

export const TEXT_FORMATS = ["plain", "url"] as const;
export const NUMBER_FORMATS = ["plain", "currency", "percent"] as const;

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

/**
 * How a text or number Field reads, stored in `project_field.config`. Unset
 * keys mean the default: plain, no unit, no bounds. A currency's `unit` is its
 * ISO 4217 code; for a plain number it is a short label such as "pts" or "h".
 * `min` and `max` bound what may be written, not what is already stored.
 */
export const fieldConfigSchema = z.object({
  format: z.enum([...TEXT_FORMATS, ...NUMBER_FORMATS]).optional(),
  unit: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});
export type FieldConfig = z.infer<typeof fieldConfigSchema>;

const finiteNumber = z
  .number()
  .refine((n) => Math.abs(n) <= FIELD_NUMBER_LIMIT, "out of range");

const FIELD_CONFIG_SCHEMAS = {
  single_choice: z.object({}).strict(),
  multi_choice: z.object({}).strict(),
  checkbox: z.object({}).strict(),
  date: z.object({}).strict(),
  text: z.object({ format: z.enum(TEXT_FORMATS).optional() }).strict(),
  number: z
    .object({
      format: z.enum(NUMBER_FORMATS).optional(),
      unit: z.string().trim().min(1).max(FIELD_UNIT_MAX).optional(),
      min: finiteNumber.optional(),
      max: finiteNumber.optional(),
    })
    .strict()
    .refine((c) => c.min === undefined || c.max === undefined || c.min <= c.max)
    .refine((c) => c.format !== "currency" || /^[A-Z]{3}$/.test(c.unit ?? ""))
    .refine((c) => c.format !== "percent" || c.unit === undefined),
} as const satisfies Record<FieldType, z.ZodType>;

/** The config for a Field of this type, or undefined when it is not one the type allows. */
export function parseFieldConfig(
  type: FieldType,
  config: unknown,
): FieldConfig | undefined {
  const parsed = FIELD_CONFIG_SCHEMAS[type].safeParse(config);
  return parsed.success ? (parsed.data as FieldConfig) : undefined;
}

/**
 * The value schema of each type: what `fieldValues[fieldId]` holds. A checkbox
 * stores `true`; unchecking removes the key like any other cleared value.
 */
export const FIELD_VALUE_SCHEMAS = {
  /** The id of one of the Field's options. */
  single_choice: z.string().min(1),
  /** Ids of the Field's options, at least one, each once. */
  multi_choice: z
    .array(z.string().min(1))
    .min(1)
    .max(MAX_FIELD_OPTIONS)
    .refine((ids) => new Set(ids).size === ids.length),
  text: z.string().trim().min(1).max(FIELD_TEXT_MAX),
  number: finiteNumber,
  /** A calendar day, `YYYY-MM-DD`, never a Date. */
  date: z.string().refine(isCalendarDate),
  checkbox: z.literal(true),
} as const satisfies Record<FieldType, z.ZodType>;

export type FieldValue = {
  [Type in FieldType]: z.infer<(typeof FIELD_VALUE_SCHEMAS)[Type]>;
}[FieldType];

/** What a Task row carries: a value per Field id; unset Fields are absent. */
export const fieldValuesSchema = z.record(
  z.string(),
  z.union([z.string(), finiteNumber, z.literal(true), z.array(z.string())]),
);
export type FieldValues = z.infer<typeof fieldValuesSchema>;

type FieldShape = {
  type: FieldType;
  config: FieldConfig;
  options: readonly FieldOption[];
};

/**
 * The value as it would be stored, if it is right for the Field: the type's
 * schema, a choice naming only options the Field has, a URL text a web address,
 * a number inside the Field's bounds.
 */
export function checkFieldValue(
  field: FieldShape,
  value: unknown,
): { ok: true; value: FieldValue } | { ok: false } {
  const parsed = FIELD_VALUE_SCHEMAS[field.type].safeParse(value);
  if (!parsed.success) return { ok: false };
  const checked = parsed.data as FieldValue;
  if (isChoiceType(field.type)) {
    const ids = typeof checked === "string" ? [checked] : (checked as string[]);
    if (!ids.every((id) => field.options.some((o) => o.id === id))) {
      return { ok: false };
    }
  }
  if (field.type === "text" && field.config.format === "url") {
    if (!isHttpUrl(checked as string)) return { ok: false };
  }
  if (field.type === "number") {
    const { min, max } = field.config;
    if (min !== undefined && (checked as number) < min) return { ok: false };
    if (max !== undefined && (checked as number) > max) return { ok: false };
  }
  return { ok: true, value: checked };
}

/** The next palette colour for a new option: the first not yet used, else cycling. */
export function nextOptionColor(options: readonly { color: string }[]) {
  const used = new Set(options.map((option) => option.color));
  return (
    COLUMN_COLORS.find((color) => !used.has(color)) ??
    COLUMN_COLORS[options.length % COLUMN_COLORS.length]!
  );
}

/**
 * The options of a choice Field that a stored value names, in the Field's
 * option order. Unknown ids are ignored, as is a value of the wrong shape, so
 * the web app tolerates a Field whose options changed under a Task.
 */
export function optionsHeld(
  field: { options: readonly FieldOption[] },
  value: FieldValue | undefined,
) {
  const ids =
    typeof value === "string" ? [value] : Array.isArray(value) ? value : [];
  return field.options.filter((option) => ids.includes(option.id));
}

/**
 * A value as people and tools outside the app write it: options by name, a
 * checkbox as a boolean, the rest as stored. Used by export, import and MCP.
 */
export type NamedFieldValue = string | number | boolean | string[];
export const namedFieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

/** A stored value by name; undefined when it names no option the Field still has. */
export function nameFieldValue(
  field: { type: FieldType; options: readonly FieldOption[] },
  value: FieldValue,
): NamedFieldValue | undefined {
  if (!isChoiceType(field.type)) return value as NamedFieldValue;
  const names = optionsHeld(field, value).map((option) => option.name);
  if (names.length === 0) return undefined;
  return field.type === "single_choice" ? names[0] : names;
}

/**
 * The stored value for a named one, `null` to clear. Choices match option
 * names ignoring case; a name that is no option comes back as `unknownOption`.
 * A multi choice also takes a single name, `[]` clears, and a checkbox takes
 * `true` or `false`.
 */
export function unnameFieldValue(
  field: FieldShape,
  named: unknown,
):
  | { ok: true; value: FieldValue | null }
  | { ok: false; unknownOption?: string } {
  if (named === null) return { ok: true, value: null };
  let value: unknown = named;
  if (isChoiceType(field.type)) {
    const names = typeof named === "string" ? [named] : named;
    if (!Array.isArray(names) || names.some((n) => typeof n !== "string")) {
      return { ok: false };
    }
    if (names.length === 0) return { ok: true, value: null };
    const ids: string[] = [];
    for (const name of names as string[]) {
      const option = field.options.find(
        (o) => normalizeFieldName(o.name) === normalizeFieldName(name),
      );
      if (!option) return { ok: false, unknownOption: name };
      if (!ids.includes(option.id)) ids.push(option.id);
    }
    value = field.type === "single_choice" ? ids[0] : ids;
    if (field.type === "single_choice" && names.length !== 1) {
      return { ok: false };
    }
  } else if (field.type === "checkbox" && named === false) {
    return { ok: true, value: null };
  }
  const checked = checkFieldValue(field, value);
  return checked.ok ? { ok: true, value: checked.value } : { ok: false };
}
