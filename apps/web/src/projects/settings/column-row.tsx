import {
  COLUMN_CATEGORIES,
  type ColumnCategory,
  type ProjectColumnRow,
} from "@morrow/sync-schemas";
import { GripVertical, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { cn } from "@/design-system/cn";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/design-system/ui/select";
import { changeColumnCategory, updateColumn } from "../actions/column-actions";
import { BlurSaveInput } from "../components/blur-save-input";
import { ColumnColorMenu } from "./column-color-menu";

type ColumnRowProps = {
  column: ProjectColumnRow;
  /** Every column of the project, to place a column that changes category. */
  columns: ProjectColumnRow[];
  /** The last column of a required category can neither leave it nor be deleted. */
  isLastRequired: boolean;
  disabled: boolean;
  onDelete: (column: ProjectColumnRow) => void;
  dropIndicator: "top" | "bottom" | null;
  dragging: boolean;
  rowProps: object;
  handleProps: object;
};

/** One column in the workflow editor: handle, colour, name, category, delete. */
export function ColumnRow({
  column,
  columns,
  isLastRequired,
  disabled,
  onDelete,
  dropIndicator,
  dragging,
  rowProps,
  handleProps,
}: ColumnRowProps) {
  const { t } = useTranslation("projects");

  async function run(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      toast.error(errorMessage(t, error, t("workflow.updateError")));
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
        aria-label={t("workflow.reorderHandle", { name: column.name })}
        className="cursor-grab rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-40"
        {...handleProps}
      >
        <GripVertical aria-hidden="true" className="size-4" />
      </button>
      <ColumnColorMenu
        columnName={column.name}
        value={column.color}
        disabled={disabled}
        onChange={(color) => void run(() => updateColumn(column.id, { color }))}
      />
      <BlurSaveInput
        size="sm"
        className="min-w-0 flex-1"
        aria-label={t("workflow.nameLabel")}
        maxLength={50}
        disabled={disabled}
        value={column.name}
        onCommit={(name) => run(() => updateColumn(column.id, { name }))}
      />
      <Select
        value={column.category}
        disabled={disabled || isLastRequired}
        onValueChange={(category) =>
          void run(() =>
            changeColumnCategory(
              column.id,
              category as ColumnCategory,
              columns,
            ),
          )
        }
        items={COLUMN_CATEGORIES.map((category) => ({
          value: category,
          label: t(`categories.${category}.title`),
        }))}
      >
        <SelectTrigger
          size="sm"
          className="w-36 shrink-0"
          aria-label={t("workflow.categoryLabel", { name: column.name })}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          {COLUMN_CATEGORIES.map((category) => (
            <SelectItem key={category} value={category}>
              {t(`categories.${category}.title`)}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground"
        disabled={disabled || isLastRequired}
        aria-label={t("workflow.delete", { name: column.name })}
        onClick={() => onDelete(column)}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </li>
  );
}
