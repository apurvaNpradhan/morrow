import type { FieldOption, ProjectFieldRow } from "@morrow/sync-schemas";
import { GripVertical, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { cn } from "@/design-system/cn";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import { updateOption } from "../actions/field-actions";
import { BlurSaveInput } from "../components/blur-save-input";
import { ColumnColorMenu } from "./column-color-menu";

/** One option of a Field: handle, colour, name, delete. */
export function FieldOptionRow({
  field,
  option,
  workspaceId,
  disabled,
  onDelete,
  dropIndicator,
  dragging,
  rowProps,
  handleProps,
}: {
  field: ProjectFieldRow;
  option: FieldOption;
  workspaceId: string;
  disabled: boolean;
  onDelete: (option: FieldOption) => void;
  dropIndicator: "top" | "bottom" | null;
  dragging: boolean;
  rowProps: object;
  handleProps: object;
}) {
  const { t } = useTranslation("projects");
  const target = {
    workspaceId,
    projectId: field.projectId,
    fieldId: field.id,
  };

  async function run(patch: { name?: string; color?: string }) {
    try {
      await updateOption(target, option.id, patch);
    } catch (error) {
      toast.error(errorMessage(t, error, t("fields.optionUpdateError")));
    }
  }

  return (
    <li
      {...rowProps}
      className={cn(
        "relative flex items-center gap-2 px-3 py-2",
        dragging && "opacity-50",
        dropIndicator === "top" &&
          "before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-primary",
        dropIndicator === "bottom" &&
          "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary",
      )}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={t("fields.reorderOption", { name: option.name })}
        className="cursor-grab rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-40"
        {...handleProps}
      >
        <GripVertical aria-hidden="true" className="size-4" />
      </button>
      <ColumnColorMenu
        columnName={option.name}
        value={option.color}
        disabled={disabled}
        onChange={(color) => void run({ color })}
      />
      <BlurSaveInput
        size="sm"
        className="min-w-0 flex-1"
        aria-label={t("fields.optionNameLabel")}
        maxLength={50}
        disabled={disabled}
        value={option.name}
        onCommit={(name) => run({ name })}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground"
        disabled={disabled}
        aria-label={t("fields.deleteOption", { name: option.name })}
        onClick={() => onDelete(option)}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </li>
  );
}
