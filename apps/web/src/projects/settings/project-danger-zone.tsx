import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { ConfirmDialog } from "@/app/settings/confirm-dialog";
import { SettingsCard } from "@/app/settings/settings-card";
import { SettingsRow } from "@/app/settings/settings-row";
import { SettingsSection } from "@/app/settings/settings-section";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import type { ProjectRow } from "@morrow/sync-schemas";
import { deleteProject } from "../actions/project-actions";

export function ProjectDangerZone({
  workspace,
  project,
}: {
  workspace: { id: string; slug: string };
  project: ProjectRow;
}) {
  const { t } = useTranslation("projects");
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    try {
      await deleteProject(project.id);
      toast.success(t("general.danger.success"));
      setConfirming(false);
      await navigate({
        to: "/$slug/projects",
        params: { slug: workspace.slug },
      });
    } catch (error) {
      toast.error(errorMessage(t, error, t("general.danger.error")));
      setDeleting(false);
    }
  }

  return (
    <SettingsSection
      title={t("general.danger.title")}
      description={t("general.danger.subtitle")}
    >
      <SettingsCard tone="danger">
        <SettingsRow
          stack
          title={t("general.danger.deleteTitle")}
          description={t("general.danger.deleteDescription", {
            name: project.name,
          })}
        >
          <Button
            type="button"
            variant="destructive-outline"
            size="sm"
            onClick={() => setConfirming(true)}
          >
            {t("general.danger.deleteButton")}
          </Button>
        </SettingsRow>
      </SettingsCard>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("general.danger.modalTitle")}
        description={t("general.danger.modalDescription", {
          name: project.name,
        })}
        confirmLabel={t("general.danger.modalConfirm")}
        pendingLabel={t("common:actions.deleting")}
        pending={deleting}
        onConfirm={() => void remove()}
      />
    </SettingsSection>
  );
}
