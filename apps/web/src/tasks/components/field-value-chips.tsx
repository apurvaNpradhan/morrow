import type { TaskRow } from "@morrow/sync-schemas";
import { LabelChip } from "@/labels";
import { heldFields } from "../lib/field-value";
import { useTaskView } from "./task-view-context";

/**
 * The custom Field values a card or row shows: one chip per Field the task has
 * a value for and this device has not switched off, in Field order. The Field
 * name is the chip's tooltip.
 */
export function FieldValueChips({
  task,
  max = Number.POSITIVE_INFINITY,
}: {
  task: TaskRow;
  max?: number;
}) {
  const { fields, showsField } = useTaskView();
  const shown = heldFields(fields, task.fieldValues).filter(({ field }) =>
    showsField(field.id),
  );
  if (shown.length === 0) return null;
  return (
    <>
      {shown.slice(0, max).map(({ field, option }) => (
        <span key={field.id} title={`${field.name}: ${option.name}`}>
          <LabelChip label={option} />
        </span>
      ))}
      {shown.length > max ? (
        <span
          className="inline-flex h-5 shrink-0 items-center rounded-full border px-1.5 text-xs text-muted-foreground"
          title={shown
            .slice(max)
            .map(({ field, option }) => `${field.name}: ${option.name}`)
            .join(", ")}
        >
          +{shown.length - max}
        </span>
      ) : null}
    </>
  );
}
