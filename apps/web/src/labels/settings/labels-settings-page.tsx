import type { LabelRow } from "@morrow/sync-schemas";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { AutosaveNote } from "@/app/settings/autosave-note";
import { SettingsCard } from "@/app/settings/settings-card";
import { SettingsPage } from "@/app/settings/settings-page";
import { PageTitle } from "@/design-system/page-title";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import { Input } from "@/design-system/ui/input";
import { useSortableList } from "@/projects";
import { useWorkspacePermission } from "@/workspace";
import { createLabel, updateLabel } from "../actions/label-actions";
import { useLabels } from "../queries/use-labels";
import { DeleteLabelDialog } from "./delete-label-dialog";
import { LabelRow as LabelListRow } from "./label-row";

/** The Workspace's labels: add, rename, recolour, reorder and delete. */
export function LabelsSettingsPage({
  workspace,
}: {
  workspace: { id: string };
}) {
  const { t } = useTranslation("labels");
  const permission = useWorkspacePermission();
  const { labels } = useLabels(workspace.id);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<LabelRow | null>(null);
  const canCreate = permission.canCreateLabels();
  const canEdit = permission.canEditLabels();
  const canDelete = permission.canDeleteLabels();
  const sortable = useSortableList({
    items: labels,
    disabled: !canEdit,
    onMove: (label, position) => updateLabel(label.id, { position }),
    onError: (error) =>
      toast.error(errorMessage(t, error, t("settings.reorderError"))),
  });

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      await createLabel({ workspaceId: workspace.id, name: trimmed });
      setName("");
    } catch (error) {
      toast.error(errorMessage(t, error, t("settings.addError")));
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <PageTitle title={t("settings.pageTitle")} />
      <SettingsPage
        title={t("settings.title")}
        description={t("settings.subtitle")}
        actions={canEdit ? <AutosaveNote /> : undefined}
      >
        <SettingsCard>
          {labels.length > 0 ? (
            <ul className="divide-y divide-border">
              {labels.map((label, index) => (
                <LabelListRow
                  key={label.id}
                  label={label}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onDelete={setDeleting}
                  dropIndicator={sortable.dropIndicator(label.id)}
                  dragging={sortable.isDragging(label.id)}
                  rowProps={sortable.rowProps(label, index)}
                  handleProps={sortable.handleProps(label, index)}
                />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-xs text-muted-foreground">
              {t("settings.empty")}
            </p>
          )}
          {canCreate ? (
            <form onSubmit={add} className="flex items-center gap-2 px-3 py-2">
              <Input
                size="sm"
                className="min-w-0 flex-1"
                aria-label={t("settings.addPlaceholder")}
                placeholder={t("settings.addPlaceholder")}
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
                {t("settings.add")}
              </Button>
            </form>
          ) : null}
        </SettingsCard>
      </SettingsPage>
      <DeleteLabelDialog label={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
