import { Download, Upload } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProjectRow } from "@morrow/sync-schemas";
import { errorMessage } from "@/app/lib/error-message";
import { rpc } from "@/app/lib/orpc";
import { SettingsCard } from "@/app/settings/settings-card";
import { SettingsRow } from "@/app/settings/settings-row";
import { SettingsSection } from "@/app/settings/settings-section";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import { useWorkspacePermission } from "@/workspace";
import { ImportTasksDialog } from "./import-tasks-dialog";

/**
 * Project settings, General: export the Project's tasks to a JSON file, and
 * import tasks from one. Export needs only read access; import needs
 * permission to create tasks and a Project that is not archived.
 */
export function TasksSettingsSection({ project }: { project: ProjectRow }) {
  const { t } = useTranslation("tasks");
  const permission = useWorkspacePermission();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  async function exportTasks() {
    setExporting(true);
    try {
      const document = await rpc.tasks.export({
        workspaceId: project.workspaceId,
        projectId: project.id,
      });
      const link = window.document.createElement("a");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(document, null, 2)], {
          type: "application/json",
        }),
      );
      link.href = url;
      link.download = `${project.key}-tasks.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(errorMessage(t, error, t("export.error")));
    } finally {
      setExporting(false);
    }
  }

  const canImport = permission.canCreateTasks() && project.archivedAt === null;

  return (
    <SettingsSection title={t("settings.title")}>
      <SettingsCard>
        <SettingsRow
          stack
          title={t("export.title")}
          description={t("export.description", { key: project.key })}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={() => void exportTasks()}
          >
            <Download aria-hidden="true" />
            {t("export.button")}
          </Button>
        </SettingsRow>
        {canImport ? (
          <SettingsRow
            stack
            title={t("import.title")}
            description={t("import.description")}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImporting(true)}
            >
              <Upload aria-hidden="true" />
              {t("import.button")}
            </Button>
          </SettingsRow>
        ) : null}
      </SettingsCard>
      <ImportTasksDialog
        project={project}
        open={importing}
        onOpenChange={setImporting}
      />
    </SettingsSection>
  );
}
