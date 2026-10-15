import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/settings/settings-card";
import { SettingsRow } from "@/app/settings/settings-row";
import { SettingsSection } from "@/app/settings/settings-section";
import { Button } from "@/design-system/ui/button";
import type { ProjectRow } from "@morrow/sync-schemas";
import { DeleteProjectDialog } from "../components/delete-project-dialog";

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
      <DeleteProjectDialog
        project={project}
        open={confirming}
        onOpenChange={setConfirming}
        onDeleted={() =>
          void navigate({
            to: "/$slug/projects",
            params: { slug: workspace.slug },
          })
        }
      />
    </SettingsSection>
  );
}
