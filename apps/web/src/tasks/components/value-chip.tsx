import type { FieldValue, ProjectFieldRow } from "@morrow/sync-schemas";
import { fieldValueText } from "../lib/field-value";
import { FieldTypeIcon } from "@/projects";

/** A text, number, date or checkbox value as a small neutral chip: the type's glyph and the value. */
export function ValueChip({
  field,
  value,
}: {
  field: ProjectFieldRow;
  value: FieldValue;
}) {
  return (
    <span className="inline-flex h-5 max-w-40 shrink-0 items-center gap-1 rounded-full border px-1.5 text-xs text-muted-foreground">
      <FieldTypeIcon type={field.type} className="size-3 shrink-0" />
      <span className="truncate">{fieldValueText(field, value)}</span>
    </span>
  );
}
