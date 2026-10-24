import type { FieldValue, ProjectFieldRow } from "@morrow/sync-schemas";
import { CheckboxFieldItems } from "./checkbox-field-items";
import { ChoiceFieldItems } from "./choice-field-items";
import { DateFieldItems } from "./date-field-items";
import { MultiChoiceFieldItems } from "./multi-choice-field-items";
import { TypedFieldItems } from "./typed-field-items";

/**
 * The menu items that set a custom Field's value, by the Field's type: the
 * options of a choice, a checkbox's two states, a date's quick picks, a box to
 * type a text or number in. A dropdown, the sheet and the create dialog all
 * render these, so a Field is edited the same way everywhere.
 */
export function FieldValueItems({
  field,
  value,
  onSelect,
}: {
  field: ProjectFieldRow;
  /** What the task holds for the Field, if anything. */
  value: FieldValue | undefined;
  /** The new value, or null to clear it. */
  onSelect: (value: FieldValue | null) => void;
}) {
  switch (field.type) {
    case "single_choice":
      return (
        <ChoiceFieldItems
          field={field}
          value={typeof value === "string" ? value : undefined}
          onSelect={onSelect}
        />
      );
    case "multi_choice":
      return (
        <MultiChoiceFieldItems
          field={field}
          value={Array.isArray(value) ? value : undefined}
          onSelect={onSelect}
        />
      );
    case "checkbox":
      return (
        <CheckboxFieldItems checked={value === true} onSelect={onSelect} />
      );
    case "date":
      return (
        <DateFieldItems
          value={typeof value === "string" ? value : undefined}
          onSelect={onSelect}
        />
      );
    case "text":
    case "number":
      return (
        <TypedFieldItems field={field} value={value} onSelect={onSelect} />
      );
  }
}
