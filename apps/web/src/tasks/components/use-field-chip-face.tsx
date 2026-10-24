import type { FieldValue, ProjectFieldRow } from "@morrow/sync-schemas";
import { useTranslation } from "react-i18next";
import { LabelDot } from "@/labels";
import { fieldValueText, optionsOf } from "../lib/field-value";
import { FieldTypeIcon } from "@/projects";

/**
 * How a chip that edits a custom Field reads: a dot in the option's colour for
 * a choice, the type's glyph for the rest, and the value in words, or the
 * Field's own name, muted, while it has none.
 */
export function useFieldChipFace() {
  const { t } = useTranslation("tasks");
  return (field: ProjectFieldRow, value: FieldValue | undefined) => {
    if (value === undefined) {
      return {
        icon: <FieldTypeIcon type={field.type} />,
        text: field.name,
        muted: true,
      };
    }
    const [first] = optionsOf(field, value);
    return {
      icon: first ? (
        <LabelDot color={first.color} />
      ) : (
        <FieldTypeIcon type={field.type} />
      ),
      text:
        field.type === "checkbox"
          ? t("fieldValues.checked")
          : fieldValueText(field, value),
      muted: false,
    };
  };
}
