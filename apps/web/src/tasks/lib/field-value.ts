import {
  type FieldConfig,
  type FieldOption,
  type FieldValue,
  type FieldValues,
  isChoiceType,
  optionsHeld,
  type ProjectFieldRow,
} from "@morrow/sync-schemas";
import { formatDate } from "@/design-system/format";
import { parseDay } from "./calendar-day";

/**
 * The value a task holds for a Field, or undefined when it holds none, or what
 * it holds no longer means anything: an unknown option id, or a value of
 * another type (as when a Field is replaced under a stale task).
 */
export function fieldHeld(
  field: ProjectFieldRow,
  fieldValues: Readonly<FieldValues>,
): FieldValue | undefined {
  const value = fieldValues[field.id];
  if (value === undefined) return undefined;
  switch (field.type) {
    case "single_choice":
    case "multi_choice":
      return typeof value !== "number" &&
        value !== true &&
        optionsHeld(field, value).length > 0
        ? value
        : undefined;
    case "text":
    case "date":
      return typeof value === "string" ? value : undefined;
    case "number":
      return typeof value === "number" ? value : undefined;
    case "checkbox":
      return value === true ? value : undefined;
  }
}

/** The options a choice Field's value names, in the Field's order; none for other types. */
export function optionsOf(
  field: ProjectFieldRow,
  value: FieldValue | undefined,
): FieldOption[] {
  return isChoiceType(field.type) ? optionsHeld(field, value) : [];
}

/** The Fields a task has a value for, with the value, in Field order. */
export function heldFields(
  fields: readonly ProjectFieldRow[],
  fieldValues: Readonly<FieldValues>,
) {
  return fields.flatMap((field) => {
    const value = fieldHeld(field, fieldValues);
    return value === undefined ? [] : [{ field, value }];
  });
}

/** A number the way its Field reads: grouped, as a currency or with a percent sign or unit. */
export function formatFieldNumber(config: FieldConfig, value: number) {
  if (config.format === "currency" && config.unit) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: config.unit,
        maximumFractionDigits: 20,
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      }).format(value);
    } catch {
      // An unknown currency code reads as a plain number with the code after it.
      return `${new Intl.NumberFormat().format(value)} ${config.unit}`;
    }
  }
  const text = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 20,
  }).format(value);
  if (config.format === "percent") return `${text}%`;
  return config.unit ? `${text} ${config.unit}` : text;
}

/** A calendar day as a short date. */
export function formatFieldDate(day: string) {
  return formatDate(parseDay(day), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * A value in words, for a chip, a tooltip or a menu: option names joined by
 * commas, a number formatted, a date, the text itself (a link without its
 * scheme). A checkbox has no words of its own; callers show the Field's name.
 */
export function fieldValueText(field: ProjectFieldRow, value: FieldValue) {
  switch (field.type) {
    case "single_choice":
    case "multi_choice":
      return optionsHeld(field, value)
        .map((option) => option.name)
        .join(", ");
    case "number":
      return formatFieldNumber(field.config, value as number);
    case "date":
      return formatFieldDate(value as string);
    case "text":
      return field.config.format === "url"
        ? (value as string).replace(/^https?:\/\//, "").replace(/\/$/, "")
        : (value as string);
    case "checkbox":
      return field.name;
  }
}

/** Whether two stored values are the same, arrays by content. */
export function sameFieldValue(
  a: FieldValue | undefined,
  b: FieldValue | undefined,
) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((id, i) => id === b[i]);
  }
  return a === b;
}
