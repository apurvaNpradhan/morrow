import {
  type ColumnCategory,
  type ProjectColumnRow,
  REQUIRED_COLUMN_CATEGORIES,
} from "@morrow/sync-schemas";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { SettingsCard } from "@/app/settings/settings-card";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import { Input } from "@/design-system/ui/input";
import { createColumn, moveColumn } from "../actions/column-actions";
import { CATEGORY_ICONS } from "../lib/column-style";
import { useSortableList } from "../lib/use-sortable-list";
import { ColumnRow } from "./column-row";

type ColumnCategoryGroupProps = {
  workspaceId: string;
  projectId: string;
  category: ColumnCategory;
  /** The columns of this category, in order. */
  columns: ProjectColumnRow[];
  /** Every column of the project. */
  allColumns: ProjectColumnRow[];
  disabled: boolean;
  onDelete: (column: ProjectColumnRow) => void;
};

/** One category of the workflow: its explanation, its columns, and a row to add one. */
export function ColumnCategoryGroup({
  workspaceId,
  projectId,
  category,
  columns,
  allColumns,
  disabled,
  onDelete,
}: ColumnCategoryGroupProps) {
  const { t } = useTranslation("projects");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const required = (
    REQUIRED_COLUMN_CATEGORIES as readonly ColumnCategory[]
  ).includes(category);
  const sortable = useSortableList({
    items: columns,
    disabled,
    onMove: (column, position) => moveColumn(column.id, position),
    onError: (error) =>
      toast.error(errorMessage(t, error, t("workflow.reorderError"))),
  });
  const Icon = CATEGORY_ICONS[category];

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      await createColumn({ workspaceId, projectId, name: trimmed, category });
      setName("");
    } catch (error) {
      toast.error(errorMessage(t, error, t("workflow.addError")));
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="space-y-2">
      <header className="flex items-start gap-2.5">
        <Icon
          aria-hidden="true"
          className="mt-0.5 size-4 text-muted-foreground"
        />
        <div>
          <h2 className="text-sm font-medium">
            {t(`categories.${category}.title`)}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t(`categories.${category}.description`)}
            {required ? ` ${t("workflow.requiredNote")}` : ""}
          </p>
        </div>
      </header>
      <SettingsCard>
        {columns.length > 0 ? (
          <ul className="divide-y divide-border">
            {columns.map((column, index) => (
              <ColumnRow
                key={column.id}
                column={column}
                columns={allColumns}
                isLastRequired={required && columns.length === 1}
                disabled={disabled}
                onDelete={onDelete}
                dropIndicator={sortable.dropIndicator(column.id)}
                dragging={sortable.isDragging(column.id)}
                rowProps={sortable.rowProps(column, index)}
                handleProps={sortable.handleProps(column, index)}
              />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-3 text-xs text-muted-foreground">
            {t("workflow.empty")}
          </p>
        )}
        {disabled ? null : (
          <form onSubmit={add} className="flex items-center gap-2 px-3 py-2">
            <Input
              size="sm"
              className="min-w-0 flex-1"
              aria-label={t("workflow.addPlaceholder")}
              placeholder={t("workflow.addPlaceholder")}
              maxLength={50}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={!name.trim() || adding}
            >
              <Plus aria-hidden="true" />
              {t("workflow.add")}
            </Button>
          </form>
        )}
      </SettingsCard>
    </section>
  );
}
