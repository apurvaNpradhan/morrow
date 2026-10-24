import type {
  FieldOption,
  FieldValue,
  ProjectFieldRow,
  TaskRow,
} from "@morrow/sync-schemas";
import { LabelChip } from "@/labels";
import { heldFields, optionsOf } from "../lib/field-value";
import { useTaskView } from "./task-view-context";
import { ValueChip } from "./value-chip";

/** One chip: an option of a choice Field, or the whole value of any other. */
type Chip = {
  key: string;
  field: ProjectFieldRow;
  value: FieldValue;
  option?: FieldOption;
};

/** What a chip says in a tooltip: the Field, and the options of a choice. */
function tooltip({ field, value }: Chip) {
  const options = optionsOf(field, value);
  return options.length > 0
    ? `${field.name}: ${options.map((o) => o.name).join(", ")}`
    : field.name;
}

/**
 * The custom Field values a card or row shows: a chip per option for a choice
 * Field, one neutral chip for the rest, for each Field the task has a value for
 * and this device has not switched off, in Field order. The Field name is the
 * chip's tooltip.
 */
export function FieldValueChips({
  task,
  max = Number.POSITIVE_INFINITY,
}: {
  task: TaskRow;
  max?: number;
}) {
  const { fields, showsField } = useTaskView();
  const chips: Chip[] = heldFields(fields, task.fieldValues)
    .filter(({ field }) => showsField(field.id))
    .flatMap(({ field, value }) => {
      const options = optionsOf(field, value);
      return options.length > 0
        ? options.map((option) => ({ key: option.id, field, value, option }))
        : [{ key: field.id, field, value }];
    });
  if (chips.length === 0) return null;
  return (
    <>
      {chips.slice(0, max).map((chip) => (
        <span key={chip.key} title={tooltip(chip)}>
          {chip.option ? (
            <LabelChip label={chip.option} />
          ) : (
            <ValueChip field={chip.field} value={chip.value} />
          )}
        </span>
      ))}
      {chips.length > max ? (
        <span
          className="inline-flex h-5 shrink-0 items-center rounded-full border px-1.5 text-xs text-muted-foreground"
          title={chips.slice(max).map(tooltip).join(", ")}
        >
          +{chips.length - max}
        </span>
      ) : null}
    </>
  );
}
