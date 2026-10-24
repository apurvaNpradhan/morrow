import {
  type FieldOption,
  isChoiceType,
  type ProjectFieldRow,
} from "@morrow/sync-schemas";
import { GripVertical, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { SettingsCard } from "@/app/settings/settings-card";
import { cn } from "@/design-system/cn";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import {
  createOption,
  updateField,
  updateOption,
} from "../actions/field-actions";
import { BlurSaveInput } from "../components/blur-save-input";
import { useSortableList } from "../lib/use-sortable-list";
import { FieldTypeIcon } from "../components/field-type-icon";
import { AddNameForm } from "./add-name-form";
import { FieldConfigEditor } from "./field-config-editor";
import { FieldOptionRow } from "./field-option-row";

/** One Field: its name and handle, its options, and a row to add an option. */
export function FieldCard({
  field,
  workspaceId,
  disabled,
  onDeleteField,
  onDeleteOption,
  dropIndicator,
  dragging,
  rowProps,
  handleProps,
}: {
  field: ProjectFieldRow;
  workspaceId: string;
  disabled: boolean;
  onDeleteField: (field: ProjectFieldRow) => void;
  onDeleteOption: (field: ProjectFieldRow, option: FieldOption) => void;
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
  const sortable = useSortableList({
    items: field.options,
    disabled,
    onMove: (option, position) => updateOption(target, option.id, { position }),
    onError: (error) =>
      toast.error(errorMessage(t, error, t("fields.reorderOptionError"))),
  });

  async function rename(name: string) {
    try {
      await updateField(field.id, { name });
    } catch (error) {
      toast.error(errorMessage(t, error, t("fields.updateError")));
    }
  }

  return (
    <section
      {...rowProps}
      className={cn(
        "relative space-y-2",
        dragging && "opacity-50",
        dropIndicator === "top" &&
          "before:absolute before:inset-x-0 before:-top-1.5 before:h-0.5 before:bg-primary",
        dropIndicator === "bottom" &&
          "after:absolute after:inset-x-0 after:-bottom-1.5 after:h-0.5 after:bg-primary",
      )}
    >
      <header className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          aria-label={t("fields.reorderField", { name: field.name })}
          className="cursor-grab rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-40"
          {...handleProps}
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
        <span
          className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
          title={t(`fields.type.${field.type}`)}
        >
          <FieldTypeIcon type={field.type} />
          <span className="sr-only">{t(`fields.type.${field.type}`)}</span>
        </span>
        <BlurSaveInput
          size="sm"
          className="min-w-0 flex-1 font-medium"
          aria-label={t("fields.nameLabel")}
          maxLength={50}
          disabled={disabled}
          value={field.name}
          onCommit={rename}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          disabled={disabled}
          aria-label={t("fields.deleteField", { name: field.name })}
          onClick={() => onDeleteField(field)}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </header>
      {isChoiceType(field.type) ? (
        <SettingsCard>
          {field.options.length > 0 ? (
            <ul className="divide-y divide-border">
              {field.options.map((option, index) => (
                <FieldOptionRow
                  key={option.id}
                  field={field}
                  option={option}
                  workspaceId={workspaceId}
                  disabled={disabled}
                  onDelete={(picked) => onDeleteOption(field, picked)}
                  dropIndicator={sortable.dropIndicator(option.id)}
                  dragging={sortable.isDragging(option.id)}
                  rowProps={sortable.rowProps(option, index)}
                  handleProps={sortable.handleProps(option, index)}
                />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-xs text-muted-foreground">
              {t("fields.noOptions")}
            </p>
          )}
          {disabled ? null : (
            <AddNameForm
              placeholder={t("fields.addOptionPlaceholder")}
              addLabel={t("fields.addOption")}
              errorFallback={t("fields.addOptionError")}
              onAdd={(name) => createOption(target, name)}
            />
          )}
        </SettingsCard>
      ) : field.type === "text" || field.type === "number" ? (
        <SettingsCard>
          <FieldConfigEditor field={field} disabled={disabled} />
        </SettingsCard>
      ) : null}
    </section>
  );
}
