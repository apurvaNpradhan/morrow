import type { FieldValues, ProjectFieldRow } from "@morrow/sync-schemas";
import { fieldHeld } from "../lib/field-value";
import { FieldChipMenu } from "./field-chip-menu";
import { FieldValueItems } from "./field-value-items";
import { useFieldChipFace } from "./use-field-chip-face";

/** The create dialog's chips for the Project's custom Fields: the value chosen so far, and a menu to change it. */
export function DraftFieldChips({
  fields,
  fieldValues,
  onChange,
}: {
  fields: readonly ProjectFieldRow[];
  fieldValues: Readonly<FieldValues>;
  onChange: (fieldValues: FieldValues) => void;
}) {
  const chipFace = useFieldChipFace();
  return (
    <>
      {fields.map((field) => {
        const held = fieldHeld(field, fieldValues);
        const face = chipFace(field, held);
        return (
          <FieldChipMenu
            key={field.id}
            label={field.name}
            muted={face.muted}
            icon={face.icon}
            value={face.text}
          >
            <FieldValueItems
              field={field}
              value={held}
              onSelect={(value) => {
                const { [field.id]: _cleared, ...others } = fieldValues;
                onChange(
                  value === null ? others : { ...others, [field.id]: value },
                );
              }}
            />
          </FieldChipMenu>
        );
      })}
    </>
  );
}
