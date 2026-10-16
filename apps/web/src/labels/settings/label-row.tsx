import type { LabelRow as Label } from "@morrow/sync-schemas";
import { GripVertical, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { cn } from "@/design-system/cn";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import { BlurSaveInput } from "@/projects";
import { updateLabel } from "../actions/label-actions";
import { LabelColorMenu } from "./label-color-menu";

/** One label in the settings list: handle, colour, name, delete. */
export function LabelRow({
  label,
  canEdit,
  canDelete,
  onDelete,
  dropIndicator,
  dragging,
  rowProps,
  handleProps,
}: {
  label: Label;
  canEdit: boolean;
  canDelete: boolean;
  onDelete: (label: Label) => void;
  dropIndicator: "top" | "bottom" | null;
  dragging: boolean;
  rowProps: object;
  handleProps: object;
}) {
  const { t } = useTranslation("labels");

  async function run(change: { name?: string; color?: Label["color"] }) {
    try {
      await updateLabel(label.id, change);
    } catch (error) {
      toast.error(errorMessage(t, error, t("settings.updateError")));
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
        disabled={!canEdit}
        aria-label={t("settings.reorderHandle", { name: label.name })}
        className="cursor-grab rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-40"
        {...handleProps}
      >
        <GripVertical aria-hidden="true" className="size-4" />
      </button>
      <LabelColorMenu
        labelName={label.name}
        value={label.color}
        disabled={!canEdit}
        onChange={(color) => void run({ color })}
      />
      <BlurSaveInput
        size="sm"
        className="min-w-0 flex-1"
        aria-label={t("settings.nameLabel")}
        maxLength={50}
        disabled={!canEdit}
        value={label.name}
        onCommit={(name) => run({ name })}
      />
      {canDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label={t("settings.delete", { name: label.name })}
          onClick={() => onDelete(label)}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      ) : null}
    </li>
  );
}
