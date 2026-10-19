import type { ProjectFieldRow } from "@morrow/sync-schemas";
import { SlidersHorizontal } from "lucide-react";
import { LabelDot } from "@/labels";
import { optionHeld } from "../lib/field-value";
import { FieldChipMenu } from "./field-chip-menu";
import { FieldValueItems } from "./field-value-items";

/** The create dialog's chips for the Project's custom Fields: the value chosen so far, and a menu to change it. */
export function DraftFieldChips({
  fields,
  fieldValues,
  onChange,
}: {
  fields: readonly ProjectFieldRow[];
  fieldValues: Readonly<Record<string, string>>;
  onChange: (fieldValues: Record<string, string>) => void;
}) {
  return (
    <>
      {fields.map((field) => {
        const held = optionHeld(field, fieldValues);
        return (
          <FieldChipMenu
            key={field.id}
            label={field.name}
            muted={!held}
            icon={
              held ? (
                <LabelDot color={held.color} />
              ) : (
                <SlidersHorizontal aria-hidden="true" className="size-3.5" />
              )
            }
            value={held?.name ?? field.name}
          >
            <FieldValueItems
              field={field}
              fieldValues={fieldValues}
              onSelect={(optionId) => {
                const { [field.id]: _cleared, ...others } = fieldValues;
                onChange(
                  optionId === null
                    ? others
                    : { ...others, [field.id]: optionId },
                );
              }}
            />
          </FieldChipMenu>
        );
      })}
    </>
  );
}
